"""
Weather Predictor Service
=========================
Converts a 4-hour outside weather forecast (fetched from Open-Meteo API)
into proactive greenhouse control recommendations.

Input  : forecast list produced by weather_fetcher.py — 8 steps × 30 min
Output : list of recommendation dicts (action, reason, severity, device)

Each forecast step contains:
  time_offset_min           — minutes ahead (30, 60 … 240)
  temp                      — outside temperature (°C)
  humidity                  — outside humidity (%)
  precipitation_probability — 0–100 %

Precipitation thresholds used for device decisions:
  >= 60 %  → rain very likely   (strongly affects fan + pump)
  >= 40 %  → rain likely        (affects fan + pump)
  <  20 %  → clear / sunny      (considered when evaluating heat rules)

The 5 decision rules (highest priority first):
  1. Extreme heat incoming (> 35 °C)         → pre_cool   — fan on 30 min early
  2. Rain likely (precip >= 40 %)            → reduce_fan — shorten fan runtime
                                             → defer_pump — delay irrigation
  3. Cold front (temp drop > 3 °C, no rain) → reduce_fan — shorten fan window
  4. Mild warming (1–3 °C)                  → normal_auto — auto mode sufficient
  5. Stable conditions                       → stable      — no action needed
"""

from __future__ import annotations

# Thresholds
RAIN_THRESHOLD  = 40   # precipitation_probability >= this → rain likely
CLEAR_THRESHOLD = 20   # precipitation_probability <  this → clear / sunny


def generate_recommendations(
    predictions: list[dict],
    current_outside: dict,
) -> list[dict]:
    """
    Translate an 8-step × 30-min outside weather forecast into proactive
    greenhouse control recommendations.

    Returns a list of recommendation dicts, each with:
      action, time_offset_min, reason, severity, device
    """
    if not predictions:
        return []

    first_t    = predictions[0]["temp"]
    last_t     = predictions[-1]["temp"]
    temp_trend = last_t - first_t          # +ve = warming, -ve = cooling
    max_temp   = max(p["temp"] for p in predictions)

    rain_steps  = [p for p in predictions if p["precipitation_probability"] >= RAIN_THRESHOLD]
    rain_likely = len(rain_steps) > 0

    recs: list[dict] = []

    # ── Rule 1: Extreme heat → pre-cool early ────────────────────────────────
    if max_temp > 35:
        hot_step  = next(p for p in predictions if p["temp"] > 35)
        early_min = max(0, hot_step["time_offset_min"] - 30)
        recs.append({
            "action":          "pre_cool",
            "time_offset_min": early_min,
            "reason": (
                f"Extreme heat expected ({hot_step['temp']:.1f} °C outside) "
                f"— turn fans on 30 min early to pre-cool the greenhouse"
            ),
            "severity": "warning",
            "device":   "fan",
        })

    # ── Rule 2: Rain likely → reduce fan + defer pump ────────────────────────
    if rain_likely:
        first_rain = rain_steps[0]
        pp         = first_rain["precipitation_probability"]
        t_off      = first_rain["time_offset_min"]
        recs.append({
            "action":          "reduce_fan",
            "time_offset_min": t_off,
            "reason": (
                f"Rain likely in {t_off} min "
                f"({pp}% chance) "
                f"— outside air will cool & humidify; shorten fan runtime"
            ),
            "severity": "info",
            "device":   "fan",
        })
        recs.append({
            "action":          "defer_pump",
            "time_offset_min": t_off,
            "reason": (
                f"Rain expected in {t_off} min "
                f"({pp}% chance) "
                f"— delay irrigation; moisture will rise naturally"
            ),
            "severity": "info",
            "device":   "pump",
        })

    # ── Rule 3: Cold front → shorten fan window ───────────────────────────────
    elif temp_trend < -3 and not rain_likely:
        cool_step = next(
            (p for p in predictions if p["temp"] < first_t - 2), None
        )
        if cool_step:
            recs.append({
                "action":          "reduce_fan",
                "time_offset_min": cool_step["time_offset_min"],
                "reason": (
                    f"Temperature dropping {abs(temp_trend):.1f} °C over the next 4 h "
                    f"— fan can run for a shorter duration than usual"
                ),
                "severity": "info",
                "device":   "fan",
            })

    # ── Rule 4: Mild warming → auto mode handles it ───────────────────────────
    elif 1 < temp_trend <= 3:
        recs.append({
            "action":          "normal_auto",
            "time_offset_min": 0,
            "reason": (
                f"Mild warming expected (+{temp_trend:.1f} °C over 4 h) "
                f"— auto mode will handle this without pre-action"
            ),
            "severity": "ok",
            "device":   None,
        })

    # ── Rule 5: Stable → no action needed ────────────────────────────────────
    if not recs:
        recs.append({
            "action":          "stable",
            "time_offset_min": 0,
            "reason": (
                "Outside conditions stable — reactive auto mode is optimal, "
                "no pre-emptive action needed"
            ),
            "severity": "ok",
            "device":   None,
        })

    return recs
