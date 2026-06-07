"""
weather.py — Proactive Weather-Aware Control Service
=====================================================

Integrates OpenWeatherMap 3-hour forecast API to enable predictive threshold
adjustment before external weather events affect the greenhouse environment.

Motivation (Master-level extension):
    Reactive control (sensor → threshold → actuator) incurs a response lag equal
    to at least one sampling interval (5 s) plus propagation delay. For slow-
    changing environmental parameters such as humidity, this lag is acceptable.
    However, large-scale external events (approaching rainstorm, afternoon heat
    peak) cause step-change disturbances that the reactive loop cannot anticipate.

    Proactive control eliminates this lag by fetching a 24-hour forecast and
    adjusting actuator thresholds BEFORE the disturbance arrives, converting the
    control architecture from purely reactive to predictive-reactive.

Mathematical model (predictive threshold adjustment):
    Let T_fan be the nominal fan trigger temperature.
    Let T_fc(Δt) be the forecast temperature Δt hours ahead.
    Let α be the predictive gain factor (default 0.5).

    Adjusted threshold:
        T'_fan = T_fan - α × max(0, T_fc(Δt) - T_fan) / Δt

    Interpretation: if a temperature spike is forecast, lower the fan trigger
    threshold proportionally so the fan pre-activates before the spike arrives.

    Similarly for rain probability p_rain:
        humidity_mist_multiplier = 1 - β × p_rain
    where β = 0.3 (30% reduction in misting intensity per unit rain probability).

Setup:
    1. Register at https://openweathermap.org/api → get API key
    2. Set in backend/.env:
           OWM_API_KEY=your_key_here
           OWM_LAT=21.0285   # latitude of farm (Hanoi example)
           OWM_LON=105.8542  # longitude of farm
    3. The service polls every 30 minutes (configurable via OWM_POLL_INTERVAL_MIN).
    4. When a weather event is detected, a config update is published to EMQX on
       topic mushroom-farm/rack-1/config with adjusted thresholds.

API reference:
    https://openweathermap.org/api/one-call-3
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

# Predictive gain factors (tunable)
ALPHA = 0.5   # temperature threshold pull-down per °C of forecast excess / hour
BETA  = 0.30  # misting reduction fraction per unit rain probability (0–1)

# Forecast horizon to consider (hours ahead)
FORECAST_HORIZON_H = 3

# Nominal thresholds (mirrors firmware config.h defaults)
NOMINAL_TEMP_FAN_ON     = 30.0   # °C
NOMINAL_HUM_FAN_ON      = 50.0   # % RH
NOMINAL_SOIL_PUMP_ON    = 25.0   # %


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ForecastEvent:
    """Represents a single 3-hour forecast slot from OWM."""
    dt_txt: str
    temp_c: float
    humidity_pct: float
    rain_prob: float        # 0.0 – 1.0
    weather_main: str       # e.g. "Rain", "Clear", "Clouds"


@dataclass
class ProactiveConfig:
    """Adjusted actuator thresholds computed from forecast."""
    temp_fan_on: float    = NOMINAL_TEMP_FAN_ON
    humidity_fan_on: float = NOMINAL_HUM_FAN_ON
    soil_pump_on: float   = NOMINAL_SOIL_PUMP_ON
    mode: str             = "auto"
    reason: str           = "nominal"   # human-readable explanation


# ── Internal state ────────────────────────────────────────────────────────────

_latest_config: ProactiveConfig = ProactiveConfig()


def get_latest_proactive_config() -> ProactiveConfig:
    """Return the most recently computed proactive configuration."""
    return _latest_config


# ── Forecast fetch ────────────────────────────────────────────────────────────

async def fetch_forecast() -> list[ForecastEvent]:
    """
    Fetch the next 24 hours of 3-hour forecast slots from OpenWeatherMap.
    Returns an empty list if the API key is not configured or the request fails.
    """
    api_key = getattr(settings, "owm_api_key", None)
    lat     = getattr(settings, "owm_lat", None)
    lon     = getattr(settings, "owm_lon", None)

    if not api_key or not lat or not lon:
        log.debug("[Weather] OWM credentials not set — weather service disabled.")
        return []

    params = {
        "lat":   lat,
        "lon":   lon,
        "appid": api_key,
        "units": "metric",
        "cnt":   8,          # 8 × 3 h = 24 h ahead
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(OWM_FORECAST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        log.warning("[Weather] Forecast fetch failed: %s", exc)
        return []

    events: list[ForecastEvent] = []
    for slot in data.get("list", []):
        events.append(ForecastEvent(
            dt_txt       = slot.get("dt_txt", ""),
            temp_c       = slot["main"]["temp"],
            humidity_pct = slot["main"]["humidity"],
            rain_prob    = slot.get("pop", 0.0),          # probability of precipitation
            weather_main = slot["weather"][0]["main"] if slot.get("weather") else "Unknown",
        ))
    return events


# ── Proactive logic ───────────────────────────────────────────────────────────

def compute_proactive_config(events: list[ForecastEvent]) -> ProactiveConfig:
    """
    Apply predictive threshold adjustment based on the nearest forecast horizon.

    Rules:
    ┌─────────────────────────────┬──────────────────────────────────────────┐
    │ Forecast condition          │ Proactive action                         │
    ├─────────────────────────────┼──────────────────────────────────────────┤
    │ p_rain > 0.70 within 3 h   │ Reduce misting (humidity will rise       │
    │                             │ naturally); lower soil_pump_on threshold │
    │                             │ to avoid over-watering.                  │
    ├─────────────────────────────┼──────────────────────────────────────────┤
    │ T_forecast > 32 °C          │ Lower fan trigger by α×excess/Δt so fan │
    │                             │ pre-activates before heat peak arrives.  │
    ├─────────────────────────────┼──────────────────────────────────────────┤
    │ T_forecast < 18 °C          │ Raise fan trigger (no cooling needed);   │
    │                             │ flag advisory for heating supplementation│
    └─────────────────────────────┴──────────────────────────────────────────┘
    """
    if not events:
        return ProactiveConfig(reason="no forecast data — using nominal thresholds")

    # Look at the nearest slot(s) within the forecast horizon
    nearest = events[:max(1, FORECAST_HORIZON_H)]

    max_temp   = max(e.temp_c      for e in nearest)
    max_rain   = max(e.rain_prob   for e in nearest)
    min_temp   = min(e.temp_c      for e in nearest)

    temp_fan   = NOMINAL_TEMP_FAN_ON
    hum_fan    = NOMINAL_HUM_FAN_ON
    soil_pump  = NOMINAL_SOIL_PUMP_ON
    reasons: list[str] = []

    # ── Rule 1: Rain approaching — reduce misting ──────────────────────────
    if max_rain > 0.70:
        # Humidity will rise naturally → reduce the misting drive
        # Increase the soil_pump_on threshold so pump activates LESS frequently
        reduction = BETA * max_rain          # fraction of reduction
        soil_pump = NOMINAL_SOIL_PUMP_ON * (1 - reduction)
        soil_pump = max(10.0, soil_pump)     # never below safety floor
        reasons.append(
            f"rain p={max_rain:.0%} → soil_pump_on reduced to {soil_pump:.1f}% "
            f"(β={BETA}, natural humidity rise expected)"
        )

    # ── Rule 2: Heat peak approaching — pre-cool ───────────────────────────
    if max_temp > NOMINAL_TEMP_FAN_ON:
        excess   = max_temp - NOMINAL_TEMP_FAN_ON     # °C above nominal trigger
        delta_t  = FORECAST_HORIZON_H                  # hours ahead
        pulldown = ALPHA * excess / delta_t
        temp_fan = max(18.0, NOMINAL_TEMP_FAN_ON - pulldown)
        reasons.append(
            f"T_forecast={max_temp:.1f}°C > {NOMINAL_TEMP_FAN_ON}°C "
            f"→ T_fan lowered to {temp_fan:.1f}°C "
            f"(α={ALPHA}, Δt={delta_t}h, pulldown={pulldown:.1f}°C)"
        )

    # ── Rule 3: Cold front — suppress cooling ──────────────────────────────
    if min_temp < 18.0:
        temp_fan = NOMINAL_TEMP_FAN_ON + 5.0   # raise trigger; cooling not needed
        reasons.append(
            f"T_forecast={min_temp:.1f}°C < 18°C (P. ostreatus min) "
            f"→ fan trigger raised to {temp_fan:.1f}°C; heating advisory"
        )

    reason_str = "; ".join(reasons) if reasons else "nominal — no significant forecast event"

    return ProactiveConfig(
        temp_fan_on    = round(temp_fan,  1),
        humidity_fan_on= round(hum_fan,   1),
        soil_pump_on   = round(soil_pump, 1),
        mode           = "auto",
        reason         = reason_str,
    )


# ── MQTT publish helper ───────────────────────────────────────────────────────

async def publish_config(cfg: ProactiveConfig, mqtt_publish_fn) -> None:
    """
    Publish updated thresholds to the firmware via MQTT config topic.
    mqtt_publish_fn: async callable(topic: str, payload: dict) provided by broadcaster.
    """
    import json
    payload = {
        "mode": cfg.mode,
        "thresholds": {
            "temp_fan_on":      cfg.temp_fan_on,
            "humidity_fan_on":  cfg.humidity_fan_on,
            "soil_pump_on":     cfg.soil_pump_on,
        },
        "source": "weather_proactive",
        "reason": cfg.reason,
    }
    topic = f"{settings.mqtt_topic_prefix}/rack-1/config"
    await mqtt_publish_fn(topic, json.dumps(payload))
    log.info("[Weather] Published proactive config: %s", cfg.reason)


# ── Background polling loop ───────────────────────────────────────────────────

async def weather_polling_loop(mqtt_publish_fn, poll_interval_min: int = 30) -> None:
    """
    Background coroutine: poll OWM every `poll_interval_min` minutes,
    compute proactive config, and publish to firmware if thresholds changed.
    Start this from the FastAPI lifespan startup hook.
    """
    global _latest_config
    log.info("[Weather] Polling loop started (interval=%d min)", poll_interval_min)

    while True:
        try:
            events = await fetch_forecast()
            new_cfg = compute_proactive_config(events)

            # Only publish if something changed
            if (new_cfg.temp_fan_on   != _latest_config.temp_fan_on or
                new_cfg.soil_pump_on  != _latest_config.soil_pump_on):
                await publish_config(new_cfg, mqtt_publish_fn)
                _latest_config = new_cfg
            else:
                log.debug("[Weather] No threshold change — skip publish.")

        except Exception as exc:
            log.error("[Weather] Polling error: %s", exc)

        await asyncio.sleep(poll_interval_min * 60)
