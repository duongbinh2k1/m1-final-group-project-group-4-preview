import asyncio
import json
import ssl
import threading
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from app.core.config import settings
from app.core.store import store
from app.models.enums import HealthStatus, MQTTStatus
from app.models.schemas import AIPayload, CommandPayload, ControlPayload, DevicesPayload, EnvironmentPayload
from app.services import supabase_db
from app.services.notifier import notify_status_change

_loop: asyncio.AbstractEventLoop | None = None
_client: mqtt.Client | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def _push_state() -> None:
    """Thread-safe: schedule a broadcast on the asyncio event loop."""
    if _loop and not _loop.is_closed():
        from app.services.broadcaster import broadcast_state
        asyncio.run_coroutine_threadsafe(broadcast_state(), _loop)


def _schedule(coro) -> None:
    """Thread-safe: schedule any coroutine on the asyncio event loop (fire-and-forget)."""
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(coro, _loop)


def publish_command(payload: CommandPayload) -> bool:
    """Publish a one-shot device command (ephemeral, no retain).
    state=None is excluded from JSON so firmware receives CMD_NONE (release to mode).
    """
    if _client is None or not _client.is_connected():
        return False
    raw = json.dumps(payload.model_dump(mode="json", exclude_none=True))
    result = _client.publish(settings.topic_command, raw, qos=1, retain=False)
    return result.rc == mqtt.MQTT_ERR_SUCCESS


def publish_control(payload: ControlPayload) -> bool:
    """Publish control config to firmware. Returns True if sent successfully."""
    if _client is None or not _client.is_connected():
        return False
    raw = json.dumps(payload.model_dump(mode="json"))
    result = _client.publish(settings.topic_config, raw, qos=1, retain=True)
    return result.rc == mqtt.MQTT_ERR_SUCCESS


# ─── paho callbacks ───────────────────────────────────────────────────────────

def _on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        store.set_mqtt_status(MQTTStatus.connected)
        client.subscribe(settings.topic_wildcard)
        print(f"[MQTT] Connected → subscribed to {settings.topic_wildcard}")

        # Re-publish retained config so firmware picks it up after reconnect
        publish_control(store.control)
    else:
        store.set_mqtt_status(MQTTStatus.error)
        print(f"[MQTT] Connection failed rc={rc}")


def _on_disconnect(client, userdata, rc, properties=None, reason=None):
    store.set_mqtt_status(MQTTStatus.disconnected)
    print("[MQTT] Disconnected")


def _on_message(client, userdata, msg):
    topic = msg.topic
    raw   = msg.payload.decode("utf-8")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[MQTT] Bad JSON on {topic}: {raw[:80]}")
        return

    ts = datetime.now(timezone.utc)

    try:
        if topic == settings.topic_environment:
            payload = EnvironmentPayload(**data)
            store.update_environment(payload, payload.timestamp)
            print(f"[ENV]  {payload.air_temperature}°C  hum={payload.air_humidity}%  soil={payload.soil_moisture}%")
            _schedule(supabase_db.insert_environment({
                "timestamp":       payload.timestamp.isoformat(),
                "air_temperature": payload.air_temperature,
                "air_humidity":    payload.air_humidity,
                "soil_moisture":   payload.soil_moisture,
            }))

        elif topic == settings.topic_devices:
            payload = DevicesPayload(**data)
            prev_devices = store.devices
            store.update_devices(payload, ts)
            print(f"[DEV]  fan={payload.fan}  pump={payload.pump}")
            if prev_devices is None or prev_devices.fan != payload.fan or prev_devices.pump != payload.pump:
                _schedule(supabase_db.insert_devices({"timestamp": ts.isoformat(), **payload.model_dump()}))

        elif topic == settings.topic_ai:
            payload = AIPayload(**data)
            prev_ai = store.ai
            store.update_ai(payload, ts)
            print(f"[AI]   status={payload.status}")
            if prev_ai is None or prev_ai.status != payload.status:
                _schedule(supabase_db.insert_ai({"timestamp": ts.isoformat(), **payload.model_dump()}))
                # Telegram: only notify inside the change-detection block
                if settings.telegram_bot_token and settings.telegram_chat_id:
                    _schedule(notify_status_change(
                        payload.status,
                        settings.telegram_bot_token,
                        settings.telegram_chat_id,
                    ))

        else:
            return  # ignore config echo and other topics

    except Exception as exc:
        print(f"[MQTT] Validation error on {topic}: {exc}")
        return

    _push_state()


# ─── Thread entry point ───────────────────────────────────────────────────────

def _run_mqtt():
    global _client
    _client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"mushroom-backend-{int(time.time())}",
    )
    _client.on_connect    = _on_connect
    _client.on_disconnect = _on_disconnect
    _client.on_message    = _on_message

    if settings.mqtt_username:
        _client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

    if settings.mqtt_port == 8883:
        ca = settings.mqtt_ca_cert or None
        _client.tls_set(ca_certs=ca, cert_reqs=ssl.CERT_REQUIRED)

    print(f"[MQTT] Connecting to {settings.mqtt_broker}:{settings.mqtt_port} ...")
    _client.connect(settings.mqtt_broker, settings.mqtt_port, keepalive=60)
    _client.loop_forever()


def start_mqtt_thread() -> threading.Thread:
    t = threading.Thread(target=_run_mqtt, daemon=True, name="mqtt-thread")
    t.start()
    return t
