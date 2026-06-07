"""
Proactive Scheduler
===================
Watches the weather forecast and automatically sends timed MQTT commands
to the ESP8266 before conditions change — turning the recommendations
into real actuator actions.

Rules that trigger auto-commands (when PROACTIVE_ENABLED=true):

  defer_pump  → Rain incoming within 2 h
                Send: pump ON for PUMP_PRE_RAIN_DURATION seconds, then auto-release
                Why:  Water the plants now before the rain makes it unnecessary

  pre_cool    → Extreme heat (> 35 °C) expected within 4 h
                Send: fan ON for 90 min, then auto-release back to auto mode
                Why:  Pre-cool the greenhouse before the heat front arrives

Each action is de-duplicated per hour window so the same command is never
sent twice within the same hour, even though forecasts refresh every 30 min.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.store import store
from app.models.schemas import CommandPayload

if TYPE_CHECKING:
    pass


class ProactiveScheduler:
    """
    Singleton scheduler — call process() after every forecast update.
    Maintains a set of already-executed action keys to prevent duplicates.
    """

    def __init__(self):
        # key: "{action}_{YYYYMMDDHH}" — one execution per action per hour
        self._sent: dict[str, str] = {}   # key → ISO timestamp when sent

    # ─── Public entry point ───────────────────────────────────────────────────

    async def process(self, recommendations: list[dict]) -> None:
        """
        Called after every forecast refresh.
        Iterates recommendations and fires the appropriate MQTT commands.
        """
        if not settings.proactive_enabled:
            return

        hour_window = datetime.now(timezone.utc).strftime("%Y%m%d%H")

        for rec in recommendations:
            action = rec.get("action")
            key    = f"{action}_{hour_window}"

            if key in self._sent:
                continue   # already handled this action this hour

            if action == "defer_pump":
                await self._handle_pre_rain_pump(rec, key)

            elif action == "pre_cool":
                await self._handle_pre_cool_fan(rec, key)

        # Evict keys older than 48 h to prevent unbounded growth
        self._evict_old_keys()

    # ─── Action handlers ──────────────────────────────────────────────────────

    async def _handle_pre_rain_pump(self, rec: dict, key: str) -> None:
        """
        Rain is coming → run pump now for PUMP_PRE_RAIN_DURATION seconds.
        The ESP8266 auto-releases the pump back to mode logic after the timer.
        Only acts if rain is expected within 2 hours.
        """
        rain_in_min = rec.get("time_offset_min", 999)
        if rain_in_min > 120:
            return   # rain too far away — skip

        duration = settings.pump_pre_rain_duration
        ok = _publish(CommandPayload(device="pump", state=True, duration=duration))

        if ok:
            log = _make_log(
                action       = "pump_on",
                device       = "pump",
                duration_s   = duration,
                reason       = (
                    f"Pre-rain watering — rain expected in {rain_in_min} min "
                    f"(precipitation probability: "
                    f"{rec.get('precipitation_probability', '?')}%). "
                    f"Pump will auto-stop after {duration // 60} min."
                ),
            )
            store.add_scheduled_action(log)
            self._sent[key] = log["sent_at"]
            print(
                f"[Scheduler] PUMP ON for {duration // 60} min "
                f"(rain in {rain_in_min} min)"
            )

    async def _handle_pre_cool_fan(self, rec: dict, key: str) -> None:
        """
        Extreme heat incoming → turn fan on now for 90 min.
        After 90 min the ESP8266 releases back to auto mode, which will keep
        the fan on anyway once the temperature actually rises inside.
        """
        duration = 90 * 60   # 90 minutes
        ok = _publish(CommandPayload(device="fan", state=True, duration=duration))

        if ok:
            log = _make_log(
                action     = "fan_on",
                device     = "fan",
                duration_s = duration,
                reason     = (
                    f"Pre-cooling — {rec.get('reason', 'extreme heat expected')}. "
                    f"Fan will auto-release after 90 min."
                ), 
            )
            store.add_scheduled_action(log)
            self._sent[key] = log["sent_at"]
            print(f"[Scheduler] FAN ON for 90 min (pre-cool)")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _evict_old_keys(self) -> None:
        """Remove sent-action entries older than 48 hours."""
        now = datetime.now(timezone.utc)
        stale = [
            k for k, ts in self._sent.items()
            if (now - datetime.fromisoformat(ts)).total_seconds() > 172_800
        ]
        for k in stale:
            del self._sent[k]


# ─── Module-level helpers ─────────────────────────────────────────────────────

def _publish(payload: CommandPayload) -> bool:
    from app.services.mqtt import publish_command
    try:
        return publish_command(payload)
    except Exception as exc:
        print(f"[Scheduler] MQTT publish failed: {exc}")
        return False


def _make_log(*, action: str, device: str, duration_s: int = 0, reason: str) -> dict:
    return {
        "action":     action,
        "device":     device,
        "duration_s": duration_s,
        "reason":     reason,
        "sent_at":    datetime.now(timezone.utc).isoformat(),
        "auto_off":   f"{duration_s // 60} min" if duration_s else "manual release",
    }


# Singleton
scheduler = ProactiveScheduler()
