"""
Duration Calculator
===================
Calculates how long to run the pump or fan based on actual sensor readings
and the physical parameters of the greenhouse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PUMP FORMULA — Volumetric Water Content (VWC)
─────────────────────────────────────────────
Source:
  Topp, G.C., Davis, J.L., & Annan, A.P. (1980).
  "Electromagnetic determination of soil water content."
  Water Resources Research, 16(3), 574-580.

  Definition: VWC (%) = volume of water / volume of soil × 100

Derivation (from hardware measurements):
  Soil volume (V_soil)   = 600 cm³   (60 cm² tray × 10 cm depth)
  Pump flow rate (Q_pump) = 1.66 ml/s (100 L/h ÷ 3600 s)

  Water needed for 1% VWC = V_soil × 0.01 = 6 ml
  Time for 1% VWC change  = 6 ml / 1.66 ml/s ≈ 3.6 s

  K_PUMP = V_soil × 0.01 / Q_pump   [s / %VWC]

Formula:
  T_pump = (target_moisture - current_moisture) × K_PUMP   [seconds]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAN FORMULA — Forced Ventilation Cooling (Newton's Law of Cooling)
──────────────────────────────────────────────────────────────────
Source:
  Incropera, F.P. & DeWitt, D.P. (2007).
  Fundamentals of Heat and Mass Transfer (6th ed.). Wiley.
  Chapter 11: Heat Exchangers.

  Albright, L.D. (1990).
  Environment Control for Animals and Plants.
  American Society of Agricultural Engineers (ASAE), Chapter 4.

Derivation:
  The greenhouse is modelled as a well-mixed thermal system ventilated
  by a fan at constant airflow rate Q (m³/s).  The energy balance gives
  a first-order ODE:

      M_total × dT/dt = -Q × ρ_air × Cp_air × (T_inside - T_outside)

  Where M_total = total thermal mass of the system (J/°C):
      M_air  = V_greenhouse × ρ_air × Cp_air
             = 0.027 m³ × 1.2 kg/m³ × 1005 J/(kg·°C) ≈ 32.6 J/°C
      M_soil = m_soil × Cp_soil
             = 0.78 kg × 1500 J/(kg·°C)              ≈ 1170 J/°C
             (600 cm³ × 1.3 g/cm³ = 780 g; Cp_moist_soil ≈ 1500 J/kg·°C
              ref: Farouki, O.T. (1981). Thermal Properties of Soils.
              CRREL Monograph 81-1.)
      M_total ≈ 1202 J/°C

  Time constant:  τ = M_total / (Q × ρ_air × Cp_air)

  Analytical solution (exponential decay):
      T(t) = T_outside + (T_inside - T_outside) × exp(-t / τ)

  Solving for t to reach T_target:
      T_fan = -τ × ln((T_target - T_outside) / (T_inside - T_outside))

  Fan airflow Q defaults to 0.005 m³/s (~10 CFM), typical for a small
  5 V cooling fan.  Measure your specific fan and set FAN_AIRFLOW_M3_PER_S
  accordingly (listed on the fan spec sheet, or use an anemometer).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import math

# ── Greenhouse physical constants ──────────────────────────────────────────────
GREENHOUSE_VOLUME_M3    = 0.027     # 30 × 30 × 30 cm = 0.027 m³
AIR_DENSITY_KG_M3       = 1.2      # kg/m³  at ~25 °C, sea level
AIR_CP_J_KG_C           = 1005.0   # J/(kg·°C)  specific heat of dry air

# Soil thermal mass
# m_soil = 600 cm³ × 1.3 g/cm³ = 780 g = 0.78 kg
# Cp_moist_soil ≈ 1500 J/(kg·°C)  [Farouki 1981]
SOIL_MASS_KG            = 0.78
SOIL_CP_J_KG_C          = 1500.0

M_AIR   = GREENHOUSE_VOLUME_M3 * AIR_DENSITY_KG_M3 * AIR_CP_J_KG_C   # ≈ 32.6 J/°C
M_SOIL  = SOIL_MASS_KG * SOIL_CP_J_KG_C                               # ≈ 1170  J/°C
M_TOTAL = M_AIR + M_SOIL                                               # ≈ 1202  J/°C

# ── Pump constants ─────────────────────────────────────────────────────────────
SOIL_VOLUME_CM3      = 600.0        # cm³
PUMP_FLOW_ML_PER_S   = 1.66        # ml/s  (100 L/h ÷ 3600)
ML_PER_PCT_VWC       = SOIL_VOLUME_CM3 * 0.01   # 6 ml per 1 % VWC
K_PUMP               = ML_PER_PCT_VWC / PUMP_FLOW_ML_PER_S  # ≈ 3.6 s/%

PUMP_MIN_S  = 5
PUMP_MAX_S  = 120

# ── Fan constants ──────────────────────────────────────────────────────────────
# Airflow of the 5 V cooling fan in m³/s.
# Default: 0.005 m³/s ≈ 10 CFM (typical small 5 V fan).
# Replace with your fan's spec-sheet value for best accuracy.
FAN_AIRFLOW_M3_PER_S = 0.005

TARGET_TEMP_C = 30.0   # °C — desired inside temperature after pre-cooling

FAN_MIN_S  = 30
FAN_MAX_S  = 1800       # 30 min safety cap


# ── Public API ─────────────────────────────────────────────────────────────────

def pump_duration(current_soil_pct: float, target_soil_pct: float = 50.0) -> int:
    """
    Seconds to run the pump to raise soil moisture from current to target.

    Formula  (VWC definition, Topp et al. 1980):
        T_pump = (target - current) × K_PUMP
        K_PUMP = (V_soil × 0.01) / Q_pump  ≈ 3.6 s / %VWC

    Returns 0 if soil is already at or above target.

    Example:
        current=20%, target=50%  →  30 × 3.6 = 108 s
    """
    delta = max(0.0, target_soil_pct - current_soil_pct)
    if delta == 0:
        return 0
    return int(min(PUMP_MAX_S, max(PUMP_MIN_S, delta * K_PUMP)))


def fan_duration(current_inside_temp: float, outside_temp: float,
                 target_temp: float = TARGET_TEMP_C) -> int:
    """
    Seconds to run the fan to pre-cool the greenhouse from current_inside_temp
    to target_temp, drawing in outside air at outside_temp.

    Formula  (Newton's Law of Cooling — forced ventilation, Incropera 2007,
              Albright 1990):

        τ     = M_total / (Q × ρ_air × Cp_air)        [time constant, seconds]
        T_fan = -τ × ln((T_target - T_outside)
                        / (T_inside  - T_outside))

    With M_total ≈ 1202 J/°C, Q = 0.005 m³/s:
        τ ≈ 1202 / (0.005 × 1.2 × 1005) ≈ 200 s

    Examples:
        inside=34°C, outside=24°C, target=30°C
            ratio = (30-24)/(34-24) = 0.6
            T_fan = -200 × ln(0.6) ≈ 102 s  (~1.7 min)

        inside=34°C, outside=32°C, target=30°C
            ratio = (30-32)/(34-32) < 0  → outside cannot cool to target → 0

    Returns 0 if outside air is not cool enough to reach the target temperature.
    """
    delta_needed    = max(0.0, current_inside_temp - target_temp)
    delta_available = current_inside_temp - outside_temp

    if delta_needed == 0:
        return 0
    if delta_available <= 0:
        # Outside is warmer than inside — fan would heat the greenhouse
        return 0

    ratio = (target_temp - outside_temp) / (current_inside_temp - outside_temp)
    if ratio <= 0:
        # Target is colder than outside air — physically impossible with this fan
        return 0

    # Time constant τ (seconds)
    hc_flow = FAN_AIRFLOW_M3_PER_S * AIR_DENSITY_KG_M3 * AIR_CP_J_KG_C
    tau     = M_TOTAL / hc_flow

    seconds = -tau * math.log(ratio)
    return int(min(FAN_MAX_S, max(FAN_MIN_S, seconds)))
