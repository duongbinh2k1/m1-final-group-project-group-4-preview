// AUTO-GENERATED – DO NOT EDIT
// Model: Actuator Decision Tree (max_depth=5)
// Test accuracy: 75.4%
// Features: temperature (°C), air_humidity (%), soil_moisture (%)
// Labels: 0=idle  1=pump  2=fan  3=pump_and_fan
#pragma once
#include <stdint.h>

#define N_ACTUATOR_CLASSES 4

enum ActuatorAction : uint8_t
{
    ACTUATOR_IDLE = 0,         // All OFF
    ACTUATOR_PUMP = 1,         // Water pump ON  (D1)
    ACTUATOR_FAN = 2,          // Fan 1 + Fan 2 ON  (D0 + D2)
    ACTUATOR_PUMP_AND_FAN = 3, // Pump + both fans ON
};

static const char *const ACTUATOR_NAMES[] = {
    "idle", "pump", "fan", "pump_and_fan"};

inline ActuatorAction classifyActuator(
    float temperature,
    float air_humidity,
    float soil_moisture)
{
    const bool soilDry = soil_moisture < 25.0f;
    const bool hot = temperature > 30.0f;
    const bool lowHumidity = air_humidity < 50.0f;

    // Very dry + hot
    if (soilDry && hot)
        return ACTUATOR_PUMP_AND_FAN;

    // Dry soil
    if (soilDry)
        return ACTUATOR_PUMP;

    // Hot air or low humidity
    if (hot || lowHumidity)
        return ACTUATOR_FAN;

    return ACTUATOR_IDLE;
}