"""
Proactive Scheduler
===================
Watches the weather forecast and automatically sends timed MQTT commands
to the ESP8266 before conditions change — turning the recommendations
into real actuator actions.

Duration is calculated from actual sensor readings using the physics-based
formulas in duration_calculator.py (not hardcoded guesses).

Rules that trigger auto-commands (when PROACTIVE_ENABLED=true):

  defer_pump  → Rain incoming within 2 h
                Water the plants NOW before rain makes irrigation unnecessary.
                Duration = time needed to reach target soil moisture.

  pre_cool    → Extreme heat (> 35 °C) expected within 4 h
                Turn fan ON early to pre-cool the greenhouse.
                Duration = time needed to drop inside temp to TARGET_TEMP_C,
                           calculated from inside vs outside temperature delta.

Each action is de-duplicated per hour window so the same command is never
sent twice within the same hour, even though forecasts refresh every 30 min.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.core.config import settings
from app.core.store import store
from app.models.schemas import CommandPayload
from app.services.duration_calculator import fan_duration, pump_duration


class ProactiveScheduler:
    """
    Singleton scheduler — call process() after every forecast update.
    Maintains a set of already-executed action keys to prevent duplicates.
    """

    def __init__(self):
        # key: "{action}_{YYYYMMDDHH}" — one execution per action per hour
        self._sent: dict[str, str] = {}

    # ─── Public entry point ───────────────────────────────────────────────────

    async def process(self, recommendations: list[dict]) -> None:
        if not settings.proactive_enabled:
            return

        hour_window = datetime.now(timezone.utc).strftime("%Y%m%d%H")

        for rec in recommendations:
            action = rec.get("action")
            key    = f"{action}_{hour_window}"

            if key in self._sent:
                continue

            if action == "defer_pump":
                await self._handle_pre_rain_pump(rec, key)

            elif action == "pre_cool":
                await self._handle_pre_cool_fan(rec, key)

        self._evict_old_keys()

    # ─── Action handlers ──────────────────────────────────────────────────────

    async def _handle_pre_rain_pump(self, rec: dict, key: str) -> None:
        """
        Rain is coming → water plants now so they're fully irrigated before rain.
        Duration is calculated from current soil moisture to reach target.
        Only acts if rain is expected within 2 hours.
        """
        rain_in_min = rec.get("time_offset_min", 999)
        if rain_in_min > 120:
            return

        # Get current soil moisture from sensor
        env = store.environment
        current_soil = env.soil_moisture if env else 20.0   # fallback if no reading yet
        target_soil  = store.control.thresholds.soil_pump_on + 20.0  # water up to 20% above trigger

        duration = pump_duration(current_soil, target_soil)
        if duration == 0:
            return   # soil already moist enough

        ok = _publish(CommandPayload(device="pump", state=True, duration=duration))

        if ok:
            log = _make_log(
                action     = "pump_on",
                device     = "pump",
                duration_s = duration,
                reason     = (
                    f"Pre-rain watering — rain expected in {rain_in_min} min "
                    f"({rec.get('precipitation_probability', '?')}% chance). "
                    f"Soil at {current_soil:.0f}% → target {target_soil:.0f}%. "
                    f"Pump runs for {duration} s then auto-releases."
                ),
            )
            store.add_scheduled_action(log)
            self._sent[key] = log["sent_at"]
            print(
                f"[Scheduler] PUMP ON {duration}s  "
                f"soil={current_soil:.0f}% → {target_soil:.0f}%  "
                f"(rain in {rain_in_min} min)"
            )

    async def _handle_pre_cool_fan(self, rec: dict, key: str) -> None:
        """
        Extreme heat incoming → turn fan on now to pre-cool the greenhouse.
        Duration is calculated from current inside temp, outside temp, and target temp.
        """
        env         = store.environment
        prediction  = store.prediction

        inside_temp  = env.air_temperature         if env        else 30.0
        outside_temp = (
            prediction["current_outside"]["temp"]  if prediction else inside_temp - 5.0
        )

        duration = fan_duration(inside_temp, outside_temp)
        if duration == 0:
            # Outside is not cooler — fan won't help, skip
            print(
                f"[Scheduler] Skipping pre_cool — outside ({outside_temp:.1f}°C) "
                f"is not cooler than inside ({inside_temp:.1f}°C)"
            )
            return

        ok = _publish(CommandPayload(device="fan", state=True, duration=duration))

        if ok:
            log = _make_log(
                action     = "fan_on",
                device     = "fan",
                duration_s = duration,
                reason     = (
                    f"Pre-cooling — {rec.get('reason', 'extreme heat expected')}. "
                    f"Inside {inside_temp:.1f}°C, outside {outside_temp:.1f}°C "
                    f"→ target 30°C. Fan runs for {duration} s then auto-releases."
                ),
            )
            store.add_scheduled_action(log)
            self._sent[key] = log["sent_at"]
            print(
                f"[Scheduler] FAN ON {duration}s  "
                f"inside={inside_temp:.1f}°C  outside={outside_temp:.1f}°C"
            )

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _evict_old_keys(self) -> None:
        """Remove sent-action entries older than 48 hours."""
        now   = datetime.now(timezone.utc)
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
        "auto_off":   f"{duration_s} s" if duration_s else "manual release",
    }


# Singleton
scheduler = ProactiveScheduler()
