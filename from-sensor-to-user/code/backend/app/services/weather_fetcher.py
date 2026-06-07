"""
Weather Fetcher Service
=======================
Fetches current outside conditions + 4-hour forecast directly from the
Open-Meteo free API (no API key required) for the configured location
(default: Hanoi, Vietnam).

Each forecast step exposes precipitation_probability (0–100 %) so the
predictor and UI can decide rain vs clear thresholds themselves.

Runs every 30 minutes as a background asyncio task started from events.py.
"""

import asyncio

import httpx

from app.core.config import settings
from app.core.store import store

FETCH_INTERVAL_S = 1800   # 30 minutes


# ─── Open-Meteo API ───────────────────────────────────────────────────────────

async def _fetch_weather() -> dict:
    """
    Single API call that returns both:
      - current: latest observed temp + humidity
      - hourly:  next 5 h forecast with precipitation_probability & weather_code
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":       settings.location_lat,
        "longitude":      settings.location_lon,
        "current":        "temperature_2m,relative_humidity_2m",
        "hourly":         "temperature_2m,relative_humidity_2m,precipitation_probability",
        "forecast_hours": 5,      # current hour + 4 h ahead = 5 points
        "timezone":       "auto",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


def _parse(data: dict) -> tuple[dict, list[dict]]:
    """
    Parse the API response into:
      current_outside — latest observed conditions
      forecast        — 8 steps × 30 min (4 h ahead), interpolated from hourly
    """
    # ── Current conditions ────────────────────────────────────────────────────
    current_outside = {
        "temp":      float(data["current"]["temperature_2m"]),
        "humidity":  float(data["current"]["relative_humidity_2m"]),
        "timestamp": data["current"]["time"],
    }

    # ── Hourly forecast points ────────────────────────────────────────────────
    h      = data["hourly"]
    times  = h["time"]
    temps  = h["temperature_2m"]
    humids = h["relative_humidity_2m"]
    precip = h["precipitation_probability"]

    hourly = []
    for t, temp, hum, pp in zip(times, temps, humids, precip):
        if temp is None or hum is None:
            continue
        hourly.append({
            "time":                      t,
            "temp":                      float(temp),
            "humidity":                  float(hum),
            "precipitation_probability": int(pp or 0),
        })

    # ── Interpolate hourly → 30-min (5 points → 8 steps) ────────────────────
    # Pattern per pair (a, b):
    #   midpoint  @ +30 min relative to a
    #   on-the-b  @ +60 min relative to a
    # 4 pairs → 8 steps covering +30 min … +240 min (4 h)
    forecast = []
    for i in range(min(len(hourly) - 1, 4)):
        a, b = hourly[i], hourly[i + 1]

        # 30-min midpoint
        forecast.append({
            "time_offset_min":           (i * 2 + 1) * 30,
            "temp":                      round((a["temp"] + b["temp"]) / 2, 1),
            "humidity":                  round((a["humidity"] + b["humidity"]) / 2, 1),
            "precipitation_probability": max(a["precipitation_probability"],
                                             b["precipitation_probability"]),
        })
        # On-the-hour (= point b)
        forecast.append({
            "time_offset_min":           (i + 1) * 60,
            "temp":                      round(b["temp"], 1),
            "humidity":                  round(b["humidity"], 1),
            "precipitation_probability": b["precipitation_probability"],
        })

    return current_outside, forecast


# ─── Public interface ─────────────────────────────────────────────────────────

async def fetch_and_update() -> bool:
    """
    Fetch weather, build prediction dict, push to store + broadcast.
    Returns True on success.
    """
    try:
        data                     = await _fetch_weather()
        current_outside, forecast = _parse(data)

        from app.services.weather_predictor import generate_recommendations
        from app.services.proactive_scheduler import scheduler

        recommendations = generate_recommendations(forecast, current_outside)

        prediction = {
            "current_outside": current_outside,
            "predictions":     forecast,
            "recommendations": recommendations,
            "horizon_hours":   4,
            "step_minutes":    30,
            "source":          "open-meteo",
        }

        store.update_prediction(prediction)

        # Fire proactive MQTT commands based on forecast
        asyncio.create_task(scheduler.process(recommendations))

        from app.services.broadcaster import broadcast_state
        asyncio.create_task(broadcast_state())

        rain_count = sum(1 for p in forecast if p["is_rain"])
        print(
            f"[Weather] Updated — "
            f"T={current_outside['temp']:.1f}°C  "
            f"RH={current_outside['humidity']:.0f}%  "
            f"rain_steps={rain_count}/8"
        )
        return True

    except Exception as exc:
        print(f"[Weather] Fetch failed: {exc}")
        return False


async def start_weather_loop() -> None:
    """
    Background asyncio task.
    Fetches immediately on startup, then every 30 minutes.
    """
    print(
        f"[Weather] Starting — "
        f"lat={settings.location_lat}  lon={settings.location_lon}  "
        f"interval={FETCH_INTERVAL_S}s"
    )
    await fetch_and_update()

    while True:
        await asyncio.sleep(FETCH_INTERVAL_S)
        await fetch_and_update()
