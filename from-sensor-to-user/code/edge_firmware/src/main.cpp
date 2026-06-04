#include <Arduino.h>
#include "config.h"
#include "certs.h"
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

#include "plant_classifier.h"    // classifyPlantHealth() -> HealthStatus
#include "actuator_classifier.h" // classifyActuator()   -> ActuatorAction

DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ─── Control config (received from backend via MQTT) ─────────────────────────

enum ControlMode : uint8_t { MODE_OFF = 0, MODE_AUTO = 1, MODE_MANUAL = 2 };

struct Thresholds {
    float temp_fan_on     = 30.0f;  // °C
    float humidity_fan_on = 50.0f;  // % — fan ON below this
    float soil_pump_on    = 25.0f;  // % — pump ON below this
};

ControlMode currentMode   = MODE_AUTO;
Thresholds  thresholds;
unsigned long lastConfigMs = 0;   // millis() when last config was received

// ─── Command override state ───────────────────────────────────────────────────
//
// Priority (highest → lowest):
//   1. CMD_ON / CMD_OFF  — explicit user command, overrides mode bidirectionally
//   2. Mode logic        — off / auto / manual thresholds
//   3. Watchdog fallback — AUTO classify if backend silent > CONFIG_WATCHDOG_MS
//
// Timer expiry releases command back to CMD_NONE (→ mode decides),
// NOT to CMD_OFF, so plants continue being cared for by the active mode.

enum CmdState : int8_t { CMD_NONE = -1, CMD_OFF = 0, CMD_ON = 1 };

CmdState      cmdFan        = CMD_NONE;
CmdState      cmdPump       = CMD_NONE;
unsigned long pumpAutoOffAt = 0;   // millis() target; 0 = no timer

// ─── Resolve actuator action ──────────────────────────────────────────────────

ActuatorAction resolveActuatorAction(float temp, float hum, float soil)
{
    // ── STEP 1: CALCULATE THE BASE MODE LOGIC (AUTO / MANUAL / OFF) ──
    bool watchdog = (lastConfigMs > 0) &&
                    (millis() - lastConfigMs > CONFIG_WATCHDOG_MS) &&
                    (currentMode != MODE_AUTO);
    if (watchdog) {
        Serial.println("[WDG] Config timeout — fallback to AUTO classify.");
    }

    bool basePump = false;
    bool baseFan  = false;

    if (watchdog || currentMode == MODE_AUTO) {
        ActuatorAction a = classifyActuator(temp, hum, soil);
        basePump = (a == ACTUATOR_PUMP) || (a == ACTUATOR_PUMP_AND_FAN);
        baseFan  = (a == ACTUATOR_FAN)  || (a == ACTUATOR_PUMP_AND_FAN);
    } else if (currentMode == MODE_MANUAL) {
        basePump = soil < thresholds.soil_pump_on;
        baseFan  = (temp > thresholds.temp_fan_on) || (hum < thresholds.humidity_fan_on);
    }

    // ── STEP 2: APPLY FRONTEND COMMAND OVERRIDES ──
    // Manual user input wins over standard mode classifications
    bool finalPump = (cmdPump == CMD_NONE) ? basePump : (cmdPump == CMD_ON);
    bool finalFan  = (cmdFan  == CMD_NONE) ? baseFan  : (cmdFan  == CMD_ON);

    // ── STEP 3: HARDWARE SAFETY COVERS (THE ABSOLUTE ULTIMATE WINNER) ──
    // If the environment crosses dangerous extremes, ignore EVERYTHING else to protect the farm.
    if (soil < SAFETY_SOIL_MIN) {
        finalPump = true;
        Serial.println("[SAFETY LOCKOUT] Soil critical! Blocking FE override to force pump ON.");
    }
    if (temp > SAFETY_TEMP_MAX) {
        finalFan = true;
        Serial.println("[SAFETY LOCKOUT] Temperature critical! Blocking FE override to force fan ON.");
    }

    // ── STEP 4: TRANSLATE TO FINAL RETURN STATE ──    
    if (finalPump && finalFan) return ACTUATOR_PUMP_AND_FAN;
    if (finalPump)             return ACTUATOR_PUMP;
    if (finalFan)              return ACTUATOR_FAN;
    return ACTUATOR_IDLE;
}

// ─── MQTT message callback ────────────────────────────────────────────────────

void onMqttMessage(char* topic, byte* payload, unsigned int length)
{
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) {
        Serial.printf("[MQTT] JSON error on %s: %s\n", topic, err.c_str());
        return;
    }

    if (strcmp(topic, TOPIC_CONFIG) == 0) {
        const char* mode = doc["mode"] | "auto";
        if      (strcmp(mode, "off")    == 0) currentMode = MODE_OFF;
        else if (strcmp(mode, "manual") == 0) currentMode = MODE_MANUAL;
        else                                   currentMode = MODE_AUTO;

        if (doc.containsKey("thresholds")) {
            thresholds.temp_fan_on     = doc["thresholds"]["temp_fan_on"]     | 30.0f;
            thresholds.humidity_fan_on = doc["thresholds"]["humidity_fan_on"] | 50.0f;
            thresholds.soil_pump_on    = doc["thresholds"]["soil_pump_on"]    | 25.0f;
        }

        lastConfigMs = millis();  // reset watchdog
        Serial.printf("[CFG] mode=%s  temp_fan>%.1f  hum_fan<%.1f  soil_pump<%.1f\n",
                      mode, thresholds.temp_fan_on,
                      thresholds.humidity_fan_on, thresholds.soil_pump_on);

    } else if (strcmp(topic, TOPIC_COMMAND) == 0) {
        const char* device = doc["device"] | "";
        // state: true=CMD_ON, false=CMD_OFF, absent=CMD_NONE (release)
        CmdState newState = CMD_NONE;
        if (doc.containsKey("state")) {
            newState = doc["state"].as<bool>() ? CMD_ON : CMD_OFF;
        }
        int dur = doc["duration"] | 0;  // seconds

        if (strcmp(device, "fan") == 0) {
            cmdFan = newState;
            Serial.printf("[CMD] fan=%s (priority over mode)\n",
                          newState == CMD_ON ? "FORCE_ON" : newState == CMD_OFF ? "FORCE_OFF" : "RELEASE");

        } else if (strcmp(device, "pump") == 0) {
            cmdPump = newState;
            if (newState == CMD_ON && dur > 0) {
                pumpAutoOffAt = millis() + (unsigned long)dur * 1000UL;
                Serial.printf("[CMD] pump=FORCE_ON  auto-release in %ds\n", dur);
            } else {
                pumpAutoOffAt = 0;
                Serial.printf("[CMD] pump=%s\n",
                              newState == CMD_ON ? "FORCE_ON" : newState == CMD_OFF ? "FORCE_OFF" : "RELEASE");
            }
        }
    }
}

struct SensorData
{
    time_t timestamp;
    float air_temperature;
    float air_humidity;
    float soil_moisture;
    HealthStatus   health;
    ActuatorAction action;
};

SensorData dataCache[MAX_CACHE_SIZE];
int cacheCount = 0;
unsigned long lastSampleTime = 0;

void syncNTPTime()
{
    Serial.println("[NTP] Synchronizing real time...");
    configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    time_t now = time(nullptr);
    int retry = 0;
    while (now < 8 * 3600 * 2 && retry < 10)
    {
        delay(500);
        Serial.print(".");
        now = time(nullptr);
        retry++;
    }
    if (now >= 8 * 3600 * 2) {
        Serial.println("\n[NTP] Synchronization complete!");
    } else {
        Serial.println("\n[NTP] Synchronization timeout. Will retry later.");
    }
}

void connectToWiFi()
{
    WiFiManager wm;
    wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT);

    // Non-blocking AP mode: if autoConnect fails (timeout), restart and try again
    Serial.println("[NETWORK] Starting WiFiManager...");
    if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD))
    {
        Serial.println("[NETWORK] WiFiManager timed out, restarting...");
        ESP.restart();
    }
    Serial.print("[NETWORK] Connected! IP: ");
    Serial.println(WiFi.localIP());
}

void reconnectMQTT()
{
    if (WiFi.status() != WL_CONNECTED)
        return;

    if (!mqttClient.connected())
    {
        Serial.print("[MQTT] Connecting to Broker...");

        char clientBuf[32];
        snprintf(clientBuf, sizeof(clientBuf), "ESP8266Client-%04X", (uint16_t)random(0, 0xffff));

        if (mqttClient.connect(clientBuf, MQTT_USER, MQTT_PASSWORD))
        {
            Serial.println("Connected!");
            mqttClient.subscribe(TOPIC_CONFIG);    // retained config from backend
            mqttClient.subscribe(TOPIC_COMMAND);   // ephemeral device commands
        }
        else
        {
            Serial.print("failed, rc=");
            Serial.print(mqttClient.state());
            Serial.println(" Will retry next cycle.");
        }
    }
}

void applyActuatorAction(ActuatorAction action)
{
    bool pump = (action == ACTUATOR_PUMP) || (action == ACTUATOR_PUMP_AND_FAN);
    bool fan  = (action == ACTUATOR_FAN)  || (action == ACTUATOR_PUMP_AND_FAN);

    digitalWrite(PUMP_PIN, pump ? RELAY_ON  : RELAY_OFF);
    digitalWrite(FAN1_PIN, fan  ? RELAY_OFF : RELAY_ON);   // fan relay is active-HIGH
    digitalWrite(FAN2_PIN, fan  ? RELAY_OFF : RELAY_ON);   // fan relay is active-HIGH

    Serial.printf("[ACT] pump=%s  fan1=%s  fan2=%s  (%s)\n",
                  pump ? "ON" : "OFF",
                  fan  ? "ON" : "OFF",
                  fan  ? "ON" : "OFF",
                  ACTUATOR_NAMES[action]);
}

bool flushCache(SensorData *dataArray, int count)
{
    if (!mqttClient.connected())
    {
        reconnectMQTT();
        if (!mqttClient.connected()) return false;
    }

    bool allOk = true;
    for (int i = 0; i < count; i++)
    {
        // Environment payload
        JsonDocument envDoc;
        envDoc["timestamp"]       = dataArray[i].timestamp;
        envDoc["air_temperature"] = dataArray[i].air_temperature;
        envDoc["air_humidity"]    = dataArray[i].air_humidity;
        envDoc["soil_moisture"]   = dataArray[i].soil_moisture;

        String envPayload;
        serializeJson(envDoc, envPayload);

        if (!mqttClient.publish(TOPIC_ENV, envPayload.c_str()))
        {
            Serial.println("[MQTT] Publish env failed. Re-aligning cache.");
            allOk = false;
            // Move untransmitted elements to the front of the cache
            int unspentCount = 0;
            for (int j = i; j < count; j++)
                dataArray[unspentCount++] = dataArray[j];
            cacheCount = unspentCount;
            return false;
        }

        // AI health status payload
        JsonDocument aiDoc;
        aiDoc["status"] = HEALTH_NAMES[dataArray[i].health];

        String aiPayload;
        serializeJson(aiDoc, aiPayload);

        if (!mqttClient.publish(TOPIC_AI, aiPayload.c_str()))
        {
            Serial.println("[MQTT] Publish ai failed.");
            allOk = false;
        }

        // Devices state derived from actuator action
        ActuatorAction act = dataArray[i].action;
        bool pumpOn = (act == ACTUATOR_PUMP)     || (act == ACTUATOR_PUMP_AND_FAN);
        bool fanOn  = (act == ACTUATOR_FAN)      || (act == ACTUATOR_PUMP_AND_FAN);

        JsonDocument devDoc;
        devDoc["fan"]  = fanOn;
        devDoc["pump"] = pumpOn;

        String devPayload;
        serializeJson(devDoc, devPayload);

        if (!mqttClient.publish(TOPIC_DEVICES, devPayload.c_str()))
        {
            Serial.println("[MQTT] Publish devices failed.");
            allOk = false;
        }
        else
        {
            Serial.printf("[MQTT] Published: %s | status=%s | fan=%d pump=%d\n",
                          envPayload.c_str(), HEALTH_NAMES[dataArray[i].health],
                          fanOn, pumpOn);
        }
    }
    return allOk;
}

void setup()
{
    pinMode(SOIL_POWER_PIN, OUTPUT);
    digitalWrite(SOIL_POWER_PIN, LOW);
    pinMode(DHTPIN, INPUT_PULLUP);

    // Actuator relay pins - start all OFF
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, RELAY_OFF);
    pinMode(FAN1_PIN, OUTPUT);
    digitalWrite(FAN1_PIN, RELAY_OFF);
    pinMode(FAN2_PIN, OUTPUT);
    digitalWrite(FAN2_PIN, RELAY_OFF);

    Serial.begin(9600);
    delay(1000);

    dht.begin();
    connectToWiFi();          // blocks until WiFi is configured and connected
    syncNTPTime();

    // TLS: verify broker certificate against embedded CA cert (DigiCert Global Root G2)
    static BearSSL::X509List certList(EMQX_CA_CERT);
    espClient.setTrustAnchors(&certList);
    
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
    mqttClient.setBufferSize(512);  // config payload can be larger than default 256 B
}

void loop()
{
    // 0. PUMP AUTO-RELEASE TIMER
    // On expiry: release command (CMD_NONE) so mode logic resumes.
    // NOT CMD_OFF — mode may legitimately keep pump running (e.g. dry soil in AUTO).
    if (cmdPump == CMD_ON && pumpAutoOffAt > 0 && millis() >= pumpAutoOffAt) {
        cmdPump       = CMD_NONE;
        pumpAutoOffAt = 0;
        Serial.println("[CMD] Pump timer expired — released to mode logic.");
    }

    // 1. NON-BLOCKING CONNECTION MANAGER
    if (WiFi.status() == WL_CONNECTED)
    {
        if (!mqttClient.connected())
        {
            static unsigned long lastMqttRetry = 0;
            if (millis() - lastMqttRetry > 5000)
            {
                lastMqttRetry = millis();
                reconnectMQTT();
            }
        }
        else
        {
            mqttClient.loop();
        }
    }

    unsigned long currentMillis = millis();

    // 2. NON-BLOCKING SAMPLING INTERVAL
    if (currentMillis - lastSampleTime >= SAMPLING_INTERVAL)
    {
        lastSampleTime = currentMillis;

        digitalWrite(SOIL_POWER_PIN, HIGH);
        delay(200);
        int rawSoil = analogRead(SOIL_ANALOG_PIN);
        digitalWrite(SOIL_POWER_PIN, LOW);

        float soilMoisture = map(rawSoil, 1023, 300, 0, 100);
        if (soilMoisture > 100) soilMoisture = 100;
        if (soilMoisture < 0)   soilMoisture = 0;

        float air_h = dht.readHumidity();
        float air_t = dht.readTemperature();

        if (isnan(air_h) || isnan(air_t))
        {
            Serial.println("[ERROR] Failed to read DHT11 sensor!");
            return;
        }

        HealthStatus   status = classifyPlantHealth(air_t, air_h, soilMoisture);
        ActuatorAction action = resolveActuatorAction(air_t, air_h, soilMoisture);

        Serial.printf("[ENV] %.1fC  %.1f%%  soil:%.1f%%  => %s\n",
                      air_t, air_h, soilMoisture, HEALTH_NAMES[status]);

        applyActuatorAction(action);

        time_t now = time(nullptr);

        if (cacheCount < MAX_CACHE_SIZE)
        {
            dataCache[cacheCount++] = {now, air_t, air_h, soilMoisture, status, action};
            Serial.printf("[CACHE] Buffered locally. Size: %d/%d\n", cacheCount, MAX_CACHE_SIZE);
        }
        else
        {
            for (int i = 1; i < MAX_CACHE_SIZE; i++)
                dataCache[i - 1] = dataCache[i];
            dataCache[MAX_CACHE_SIZE - 1] = {now, air_t, air_h, soilMoisture, status, action};
            Serial.println("[CACHE] Buffer exceeded! Overwriting oldest record.");
        }
    }

    // 3. CACHE FLUSH (runs whenever online and cache has data)
    if (WiFi.status() == WL_CONNECTED && mqttClient.connected() && cacheCount > 0)
    {
        time_t now = time(nullptr);
        if (now < 8 * 3600 * 2)
            syncNTPTime();

        Serial.println("[CACHE] Connection established. Flushing...");
        if (flushCache(dataCache, cacheCount))
        {
            cacheCount = 0;
            Serial.println("[CACHE] Flush complete. Buffer reset.");
        }
    }
}
