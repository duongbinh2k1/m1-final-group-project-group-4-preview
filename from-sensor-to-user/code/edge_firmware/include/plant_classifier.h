#pragma once
#include <stdint.h>

#define N_HEALTH_CLASSES 3

enum HealthStatus : uint8_t {
    HEALTH_HEALTHY = 0,
    HEALTH_WARNING = 1,
    HEALTH_CRITICAL = 2,
};

static const char* const HEALTH_NAMES[] = {
    "healthy",
    "warning",
    "critical"
};

inline HealthStatus classifyPlantHealth(
    float temperature,
    float air_humidity,
    float soil_moisture
) {
    // --- soil_moisture <= 19.96
    if (soil_moisture <= 19.96f) {
        // class: 2
        return HEALTH_CRITICAL;
    }
    // --- soil_moisture > 19.96
    else {
        // --- soil_moisture <= 30.04
        if (soil_moisture <= 30.04f) {
            // --- temperature <= 18.31
            if (temperature <= 18.31f) {
                // class: 1
                return HEALTH_WARNING;
            }
            // --- temperature > 18.31
            else {
                // --- soil_moisture <= 28.61
                if (soil_moisture <= 28.61f) {
                    // --- soil_moisture <= 28.05
                    if (soil_moisture <= 28.05f) {
                        // --- temperature <= 19.78
                        if (temperature <= 19.78f) {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                        // --- temperature > 19.78
                        else {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                    }
                    // --- soil_moisture > 28.05
                    else {
                        // --- air_humidity <= 51.73
                        if (air_humidity <= 51.73f) {
                            // class: 2
                            return HEALTH_CRITICAL;
                        }
                        // --- air_humidity > 51.73
                        else {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                    }
                }
                // --- soil_moisture > 28.61
                else {
                    // --- soil_moisture <= 29.54
                    if (soil_moisture <= 29.54f) {
                        // class: 1
                        return HEALTH_WARNING;
                    }
                    // --- soil_moisture > 29.54
                    else {
                        // --- soil_moisture <= 29.66
                        if (soil_moisture <= 29.66f) {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                        // --- soil_moisture > 29.66
                        else {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                    }
                }
            }
        }
        // --- soil_moisture > 30.04
        else {
            // --- soil_moisture <= 39.80
            if (soil_moisture <= 39.80f) {
                // --- air_humidity <= 53.86
                if (air_humidity <= 53.86f) {
                    // --- air_humidity <= 41.71
                    if (air_humidity <= 41.71f) {
                        // --- soil_moisture <= 32.84
                        if (soil_moisture <= 32.84f) {
                            // class: 1
                            return HEALTH_WARNING;
                        }
                        // --- soil_moisture > 32.84
                        else {
                            // class: 0
                            return HEALTH_HEALTHY;
                        }
                    }
                    // --- air_humidity > 41.71
                    else {
                        // --- soil_moisture <= 33.67
                        if (soil_moisture <= 33.67f) {
                            // class: 0
                            return HEALTH_HEALTHY;
                        }
                        // --- soil_moisture > 33.67
                        else {
                            // class: 0
                            return HEALTH_HEALTHY;
                        }
                    }
                }
                // --- air_humidity > 53.86
                else {
                    // --- air_humidity <= 54.72
                    if (air_humidity <= 54.72f) {
                        // class: 1
                        return HEALTH_WARNING;
                    }
                    // --- air_humidity > 54.72
                    else {
                        // --- air_humidity <= 65.41
                        if (air_humidity <= 65.41f) {
                            // class: 0
                            return HEALTH_HEALTHY;
                        }
                        // --- air_humidity > 65.41
                        else {
                            // class: 0
                            return HEALTH_HEALTHY;
                        }
                    }
                }
            }
            // --- soil_moisture > 39.80
            else {
                // class: 0
                return HEALTH_HEALTHY;
            }
        }
    }
}