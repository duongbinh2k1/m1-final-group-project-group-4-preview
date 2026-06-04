#ifndef CONFIG_H
#define CONFIG_H

// ─── WiFi (managed by WiFiManager — no hardcoded credentials) ────────────────
// On first boot or failed connection: device starts AP "Mushroom-Farm-Setup"
// Connect to it, open 192.168.4.1, enter WiFi credentials.
// Credentials are saved to flash and reused on subsequent boots.
#define WIFI_AP_NAME     "Mushroom-Farm-Setup"
#define WIFI_AP_PASSWORD "mushroom2024"   // AP password for config portal
#define WIFI_PORTAL_TIMEOUT 120           // seconds before AP auto-closes

#define DHTPIN 2
#define DHTTYPE DHT11

// Actuator pins (relay modules)
#define PUMP_PIN D1 // GPIO  5 – Water pump
#define FAN1_PIN D0 // GPIO 16 – Cooling fan 1
#define FAN2_PIN D2 // GPIO  4 – Cooling fan 2

// Most relay boards are active-LOW: LOW = relay ON, HIGH = relay OFF.
// If your relay is active-HIGH, swap the two values below.
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

#define SOIL_POWER_PIN 0
#define SOIL_ANALOG_PIN A0

const unsigned long SAMPLING_INTERVAL = 5000;
const int MAX_CACHE_SIZE = 120;

// EMQX Cloud TLS — port 8883
const char *const MQTT_HOST = "ace2ba13.ala.asia-southeast1.emqxsl.com";
const int         MQTT_PORT = 8883;
#define MQTT_USER     "mushroom-esp8266"
#define MQTT_PASSWORD "mushroom-esp8266"

const char *const TOPIC_ENV     = "mushroom-farm/rack-1/environment";
const char *const TOPIC_AI      = "mushroom-farm/rack-1/ai";
const char *const TOPIC_DEVICES = "mushroom-farm/rack-1/devices";
const char *const TOPIC_CONFIG  = "mushroom-farm/rack-1/config";
const char *const TOPIC_COMMAND = "mushroom-farm/rack-1/command";

// Watchdog: revert to AUTO if no MQTT config received within this window
const unsigned long CONFIG_WATCHDOG_MS = 5UL * 60UL * 1000UL;  // 5 minutes

// ─── Safety floor (hardcoded, cannot be overridden by any MQTT command) ───────
// If any condition breaches these critical thresholds, the corresponding
// actuator is forced ON regardless of mode (off/auto/manual) or command
// (FORCE_OFF). This is the last line of defence against crop loss.
const float SAFETY_SOIL_MIN  = 10.0f;  // % — pump ON if soil drops below
const float SAFETY_TEMP_MAX  = 40.0f;  // °C — fan ON if temp exceeds

#endif
