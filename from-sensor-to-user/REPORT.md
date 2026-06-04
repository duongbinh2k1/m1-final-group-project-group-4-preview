# From Sensor to User — Report

## 1. Project Title

**Smart Mushroom Greenhouse AIoT Platform**

An end-to-end IoT system that collects environmental sensor data from a mushroom cultivation greenhouse, applies on-device and cloud AI inference to classify plant health, and delivers real-time alerts and actuator control to farm operators through a web dashboard.

---

## 2. Problem Description

Mushroom cultivation is highly sensitive to environmental conditions. Temperature, air humidity, and soil moisture must stay within tight windows; deviations of even a few degrees or percentage points can cause mould outbreaks, poor fruiting, or complete crop failure within hours. Small-scale Vietnamese mushroom farms typically rely on manual checks by workers — an approach that is neither continuous nor reliable during nights and weekends.

This project addresses the problem: **how can a low-cost, connected sensor system continuously monitor a mushroom greenhouse, detect dangerous conditions early, and trigger corrective actions automatically — without requiring constant human attention?**

The system covers the complete data lifecycle:

```
Sensor reading → MQTT transmission → Cloud backend →
AI classification → Dashboard visualisation → Actuator control
```

---

## 3. Stakeholders

| Stakeholder | Interest |
|---|---|
| **Farm operator / owner** | Real-time visibility, automated responses, reduced crop loss |
| **Farm workers** | Real-time dashboard alerts, manual override capability |
| **Buyers / distributors** | Consistent product quality enabled by stable growing conditions |
| **System administrator** | Backend health, MQTT uptime, database reliability |
| **Development team** | Maintainability, extensibility to more sensors and racks |

---

## 4. PEAS Analysis

### Performance

The system is considered successful when it:

- Measures air temperature, air humidity, and soil moisture every **5 seconds** with less than ±1 °C / ±2 % RH error.
- Classifies plant health as `healthy`, `warning`, or `critical` with **≥ 85 % accuracy** compared to domain-expert labels.
- Sends actuator decisions (fan ON/OFF, water pump ON/OFF) within **2 seconds** of a sensor reading that crosses a threshold.
- Delivers a dashboard alert to the operator within **10 seconds** of a critical event via Socket.IO real-time broadcast.
- Maintains system uptime of **≥ 99 %** during growing cycles (typically 30–60 days).

### Environment

- **Physical**: A sealed or semi-sealed mushroom cultivation room / greenhouse in a subtropical Vietnamese climate. Average ambient temperatures: 25–35 °C; relative humidity: 70–90 %.
- **Network**: Wi-Fi (802.11 b/g/n) with internet access to reach the cloud MQTT broker (EMQX Cloud, Southeast Asia region). Connectivity may be intermittent.
- **Power**: 220 V AC mains with occasional outages; the ESP8266 node runs on a 5 V USB supply.
- **Operational**: Operates 24/7, monitored remotely. Physical access to hardware is infrequent.

### Actuators

| Actuator | Function | Trigger condition |
|---|---|---|
| **Cooling fan (×2)** | Reduce air temperature and improve airflow | `air_temperature > 30 °C` OR `air_humidity < 50 %` (in AUTO mode); AI classification `critical` |
| **Water mist pump** | Increase soil and air moisture | `soil_moisture < 25 %` (in AUTO mode); AI classification `warning/critical` |
| **Dashboard alert** | Notify operator via Socket.IO real-time update (stage badge turns red, warning banner) | Any `critical` AI classification |

Control modes supported: **OFF**, **AUTO** (AI-driven), **MANUAL** (threshold-based). A hardware safety floor overrides all modes if conditions become extreme (`soil < 10 %` or `temp > 40 °C`).

### Sensors

| Sensor | Measured variable | Location |
|---|---|---|
| **DHT11** | Air temperature (0–50 °C, ±2 °C), Air humidity (20–80 % RH, ±5 %) | Mounted centrally in the growing rack |
| **Capacitive soil moisture sensor** | Soil moisture (0–100 % relative, ±3 %) | Inserted into the substrate bag |

Data is published to three MQTT topics per rack:

- `mushroom-farm/rack-1/environment` — temperature, humidity, soil moisture
- `mushroom-farm/rack-1/ai` — on-device health status classification
- `mushroom-farm/rack-1/devices` — current relay states (fan, pump)

---

## 5. STA Analysis

### Constraints

| Constraint | Detail |
|---|---|
| **Computational** | ESP8266 has only 80 kHz CPU and 80 KB RAM; ML model must be compiled to C header and run inference in < 10 ms |
| **Power** | Device must survive brief power cuts; no battery backup is implemented in v1 (future work) |
| **Connectivity** | Wi-Fi may drop; MQTT QoS 1 retransmission is used, but data is lost during extended outages |
| **Cost** | Total hardware budget ≤ 500 000 VND per rack to remain viable for small farms |
| **Sensor accuracy** | DHT11 is a low-cost sensor with ±2 °C / ±5 % RH tolerance; not suitable for precision applications |
| **Regulatory** | No specific IoT agricultural regulation in Vietnam currently; GDPR does not apply (no personal data) |

### Risks

| Risk | Likelihood | Impact |
|---|---|---|
| Sensor reading drift over time | Medium | High — stale calibration leads to incorrect AI decisions |
| MQTT broker outage (cloud dependency) | Low | High — all real-time data flow stops |
| Wi-Fi disconnection | High | Medium — data gap, no remote control |
| ESP8266 firmware crash or memory leak | Low | High — silent data loss |
| Relay hardware failure | Low | High — actuators do not respond |
| Database overflow (Supabase free tier limits) | Medium | Medium — historical data truncated |

### Failure Points

1. **Sensor → Firmware**: DHT11 read errors return `NaN`; not retried with debounce in v1.
2. **Firmware → Broker**: TLS handshake fails if device clock is unsynchronised; NTP sync is performed at boot but not re-checked.
3. **Broker → Backend**: Backend process crash causes Socket.IO disconnect; clients must reconnect manually or after auto-reconnect timeout.
4. **Backend → Database**: Supabase write failures are logged but not retried; data point is silently lost.
5. **Backend → Frontend**: If Socket.IO connection drops, the dashboard shows stale data without a visible staleness indicator in v1.

### Mitigation Strategies

| Failure Point | Mitigation |
|---|---|
| Sensor NaN reads | Filter invalid readings in firmware before publishing; future: retry up to 3×  |
| Wi-Fi dropout | WiFiManager reconnect loop; local cache of up to 120 readings (10 minutes at 5 s interval) stored in firmware RAM |
| Backend crash | Systemd / Docker restart policy; Socket.IO auto-reconnect on frontend |
| Database write failure | Future: write-ahead queue with exponential backoff |
| Config/command loss | **Watchdog timer** (5 minutes): if no MQTT config message is received, firmware falls back to AUTO mode automatically |
| Extreme condition bypass | **Hardware safety floor**: hard-coded thresholds (`SAFETY_SOIL_MIN = 10 %`, `SAFETY_TEMP_MAX = 40 °C`) that cannot be overridden by any MQTT command |

---

## 6. DIKW Data Flow

### Data

Raw sensor readings from the DHT11 and the capacitive soil sensor are sampled every 5 seconds on the ESP8266. Each reading is a JSON object:

```json
{
  "timestamp": 1716288000,
  "air_temperature": 27.4,
  "air_humidity": 76.1,
  "soil_moisture": 58.3
}
```

These values have no interpretation on their own — they are simply numbers published to `mushroom-farm/rack-1/environment`.

### Information

The FastAPI backend subscribes to all MQTT topics and writes each reading into Supabase (PostgreSQL). Stored rows gain context: time-series patterns become visible, and the dashboard can compare the current reading against the 200-record history to show trends (rising temperature, falling soil moisture).

The on-device Decision Tree classifier also converts raw sensor values into a categorical **health status** (`healthy` / `warning` / `critical`) which is published to `mushroom-farm/rack-1/ai`. This classification is the first layer of *meaning* added to raw numbers.

### Knowledge

The backend aggregates the health status stream with the actuator relay states to build a situational picture:

- If `status = warning` persists for > 3 consecutive readings → elevated risk of mould.
- If `status = critical` AND `fan = false` → actuator system is not responding; alert required.
- Historical trends in the Supabase database allow the operator to correlate crop quality outcomes with environmental patterns across multiple growing cycles.

The AI model (Decision Tree trained on the UCI Plant Health dataset) encodes domain knowledge derived from 8 000+ labelled samples, mapping `(temperature, humidity, soil_moisture)` triples to health outcomes.

### Decision

Based on the health classification and the active control mode, the firmware makes a real-time actuator decision:

| Condition | Decision |
|---|---|
| `status = healthy`, MODE_AUTO | All actuators OFF |
| `status = warning`, MODE_AUTO | Pump ON if soil low; Fan ON if temp/humidity out of range |
| `status = critical`, MODE_AUTO | Both actuators ON; backend sends `critical` alert to dashboard |
| `soil < 10 %` (safety floor) | Pump ON regardless of mode or command |
| `temp > 40 °C` (safety floor) | Fan ON regardless of mode or command |

Operators can also issue manual commands (CMD_ON / CMD_OFF per actuator) via the dashboard, which override the AI decision for a configurable timer period before returning to the active mode.

### User Interaction

The operator interacts with the system through:

1. **Web dashboard** (React + Vite): real-time metric cards, trend charts (Recharts), AI stage badge, relay toggle switches, control mode selector (OFF / AUTO / MANUAL), and a 3D digital twin rendered with Three.js that visually reflects current sensor states.
2. **Mobile app** (React Native / Expo): same data feed via the same backend REST + Socket.IO API; real-time sensor view and control. *(Push notification via Telegram bot is implemented in the codebase but not configured in the current production deployment.)*
3. **MQTT command channel** (`mushroom-farm/rack-1/command`): operators can send JSON commands directly for integration with third-party automation tools.

---

## 7. System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  EDGE LAYER (Physical Hardware)                                  │
│                                                                  │
│  DHT11 ─┐                                                        │
│          ├─► ESP8266 (Arduino/PlatformIO)                        │
│  Soil  ─┘    │  • Decision Tree inference (C header)            │
│              │  • WiFiManager                                    │
│              │  • MQTT/TLS → EMQX Cloud (8883)                  │
│              │  • Safety floor watchdog                          │
│              ▼                                                    │
│       Relay board → Fan × 2, Water Pump                         │
└─────────────────────────────────────────────────────────────────┘
                              │ MQTT (TLS)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUD BROKER                                                    │
│  EMQX Cloud — Southeast Asia region                             │
│  Topics: mushroom-farm/rack-1/{environment,ai,devices,          │
│           config,command}                                        │
└─────────────────────────────────────────────────────────────────┘
                              │ paho-mqtt subscribe
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Python / FastAPI + Socket.IO)                          │
│                                                                  │
│  MQTT thread ──► AppStore (in-memory deques, 200 records)       │
│                      │                                           │
│              ┌───────┴────────┐                                  │
│              ▼                ▼                                  │
│         REST API         Socket.IO                              │
│    /api/state             "state" event                         │
│    /api/history/*         broadcast                             │
│    /api/health                                                   │
│    /api/control/*     ◄── control commands                      │
│              │                                                   │
│              ▼                                                   │
│         Supabase (PostgreSQL)                                    │
│         Tables: environment_readings, device_states,            │
│                 ai_readings, users                               │
└─────────────────────────────────────────────────────────────────┘
                    │ REST + Socket.IO
          ┌─────────┴──────────┐
          ▼                    ▼
┌──────────────────┐  ┌──────────────────────┐
│  WEB FRONTEND    │  │  MOBILE APP          │
│  React + Vite    │  │  React Native/Expo   │
│  Three.js (twin) │  │  (Telegram notif.    │
│  Recharts        │  │   code present;      │
│  Zustand store   │  │   not in prod)       │
└──────────────────┘  └──────────────────────┘
```

### Hardware Stack

| Component | Model | Purpose |
|---|---|---|
| Microcontroller | ESP8266 (NodeMCU) | Sensor reading, AI inference, MQTT publish, relay control |
| Air sensor | DHT11 | Temperature + humidity |
| Soil sensor | Capacitive v1.2 | Soil moisture |
| Relay module | 2-channel 5 V | Fan and pump switching |
| Fan | 12 V DC × 2 | Airflow and cooling |
| Pump | 5 V mini peristaltic | Water misting |

### Software Stack

| Layer | Technology |
|---|---|
| Firmware | C++ / Arduino framework, PlatformIO |
| ML on-device | Scikit-learn Decision Tree → exported C header |
| MQTT broker | EMQX Cloud (managed, TLS 8883) |
| Backend | Python 3.11, FastAPI, paho-mqtt, python-socketio |
| Database | Supabase (PostgreSQL 15) |
| Frontend | React 18, Vite, Zustand, Recharts, Three.js |
| Mobile | React Native, Expo |
| Containerisation | Docker + docker-compose |

### Communication Protocols

| Link | Protocol | Notes |
|---|---|---|
| Sensor → ESP8266 | GPIO / OneWire / I2C | Local hardware bus |
| ESP8266 → Broker | MQTT over TLS 1.2 (port 8883) | QoS 1, client certificate |
| Broker → Backend | MQTT (paho) | Background daemon thread |
| Backend → Frontend | Socket.IO (WebSocket) | Real-time state push |
| Frontend → Backend | HTTP REST | Seeding history on load; control commands |
| Backend → Database | HTTPS (Supabase JS SDK) | Async writes |

---

## 8. Implementation

### Edge Firmware (`edge_firmware/`)

- Written in C++ using the Arduino framework and built with **PlatformIO**.
- At boot: NTP time sync, WiFiManager portal for Wi-Fi credentials, TLS connection to EMQX Cloud using an embedded CA certificate (`certs.h`).
- Every 5 seconds: reads DHT11 and the capacitive soil sensor, runs `classifyPlantHealth()` and `classifyActuator()` (both compiled from `plant_classifier.h` / `actuator_classifier.h` — C headers auto-generated from Python scikit-learn models), publishes three MQTT messages.
- Subscribes to `mushroom-farm/rack-1/config` and `mushroom-farm/rack-1/command` to receive mode changes and manual actuator commands from the backend.
- **Priority chain**: Hardware safety floor > Explicit command (CMD_ON/OFF) > Control mode logic > AI classification.

### AI Model Training (`ai_analytics/`)

- Dataset: UCI Plant Health dataset (8 000+ labelled samples, features: `temperature`, `air_humidity`, `soil_moisture`).
- Two models trained with scikit-learn:
  - **Plant health classifier**: `RandomForestClassifier` → classifies `healthy / warning / critical`.
  - **Actuator classifier**: `DecisionTreeClassifier` → classifies `IDLE / PUMP / FAN / PUMP_AND_FAN`.
- Models are exported as C header files using a custom tree-traversal code generator (`train_actuator_model.py`), producing `if/else` chains that compile directly on ESP8266 without any ML library.
- Notebooks in `notebooks/` document EDA, training, and export steps.

### Backend (`backend/`)

- **FastAPI** application wrapped with **python-socketio** ASGI middleware.
- A daemon thread runs the **paho-mqtt** loop; each `on_message` callback deserialises the JSON payload into Pydantic models, updates the in-memory `AppStore` (deques of 200 records per topic), writes to Supabase, and calls `broadcaster.py` to emit a `"state"` Socket.IO event to all connected clients.
- REST routes: `/api/state`, `/api/health`, `/api/history/environment`, `/api/history/devices`, `/api/history/ai`, `/api/control/*`.
- JWT authentication on control endpoints (login via `/api/auth/login`).
- Environment variables managed via `.env` (not committed; `.env.example` provided).

### Frontend (`frontend/`)

- **React 18 + Vite** single-page application.
- State managed with two **Zustand** stores: `useGreenhouseStore` (sensor data + history arrays) and `useSocketStore` (connection status).
- The `useSocket()` hook (called once in `App.jsx`) creates the Socket.IO singleton, seeds chart history from REST on connect, and wires all `"state"` events to update the store.
- Pages: **Dashboard** (metric cards, AI stage badge), **Environment** (time-series charts), **Devices** (relay toggles), **Control** (mode selector), **Digital Twin** (Three.js 3D model), **Login**.
- Dark theme (Slate-900 background), JetBrains Mono for live values, semantic colour coding (green / amber / red).

### Simulator (`simulator/`)

- Node.js script that publishes synthetic sensor data to the same MQTT topics.
- Used during development and demo when physical hardware is unavailable.
- Supports a `sim_mode` toggle exposed via the web UI to switch the backend between live hardware and simulator.

---

## 9. Results and Demo

### Sensor Reading Accuracy

DHT11 calibration against a reference thermometer showed ±1.8 °C and ±4.2 % RH error — within the ±2 °C / ±5 % RH manufacturer specification. Soil sensor readings were stable within ±3 % when the substrate moisture was manually measured.

### AI Classification Performance

| Model | Accuracy (held-out test set, 20 %) |
|---|---|
| Plant health classifier (Random Forest) | 91.4 % |
| Actuator decision classifier (Decision Tree) | 88.7 % |

Cross-validation (5-fold stratified) confirmed no significant overfitting.

### End-to-End Latency

| Stage | Measured latency |
|---|---|
| Sensor read → MQTT publish | ~5 ms |
| MQTT publish → backend receive | ~80–150 ms (cloud broker RTT) |
| Backend receive → Socket.IO broadcast | ~5 ms |
| Socket.IO → dashboard update | ~10 ms |
| **Total sensor-to-screen** | **~100–170 ms** |

### Demo Evidence

- The simulator publishes a scenario where temperature rises from 26 °C to 38 °C over 2 minutes; the dashboard transitions from `healthy` (green) → `warning` (amber) → `critical` (red) and the relay state card shows fan ON.
- The 3D digital twin visually reflects the fan rotation state and changes colour based on the AI health classification.
- Manual override via the Control page demonstrates that CMD_ON overrides AUTO classification, and the watchdog returns control to AUTO after the timer expires.

Screenshots are available in `../images/`.

---

## 10. Security and Ethics Considerations

### Security

| Concern | Implementation |
|---|---|
| **MQTT transport** | TLS 1.2 with EMQX-issued CA certificate; device uses client credentials (`MQTT_USER`, `MQTT_PASSWORD`) |
| **Credentials in firmware** | Credentials are compiled into the binary, not stored in plaintext on flash; WiFi credentials are stored by WiFiManager in protected flash |
| **API authentication** | JWT tokens required for all control endpoints; login endpoint rate-limited |
| **Environment variables** | Backend secrets (Supabase URL, JWT secret) kept in `.env`, not committed; `.env.example` provided |
| **CORS** | Backend restricts `allow_origins` to known frontend origins |
| **No personal data** | The system collects only environmental sensor readings; no personally identifiable information is stored |

**Known limitations**: The MQTT broker credentials are embedded in firmware as plaintext `#define` macros — a device compromise would expose them. A future mitigation is to use EMQX ACL rules to restrict each device to its own topic prefix, limiting the blast radius.

### Ethics

- **Autonomy**: Control modes (AUTO/MANUAL/OFF) ensure farm workers retain agency; the AI can be fully overridden.
- **Transparency**: The AI decision chain is visible in the firmware source. The Decision Tree classifier (as opposed to a black-box neural network) produces a traceable `if/else` tree that a non-expert can inspect.
- **Accountability**: All sensor readings, relay state changes, and AI classifications are persisted to Supabase with timestamps, providing a complete audit trail.
- **Environmental responsibility**: Automated watering reduces water waste compared to scheduled irrigation; fan operation is optimised to run only when needed, reducing energy consumption.
- **Data integrity**: Sensor values are validated before database writes (range checks); anomalous readings trigger warnings rather than being silently accepted.

---

## 11. Limitations and Future Work

### Current Limitations

- **DHT11 accuracy**: The ±2 °C / ±5 % RH tolerance is marginal for precise mushroom cultivation (e.g., oyster mushrooms require humidity within ±3 %). Upgrading to DHT22 or SHT31 would significantly improve reliability.
- **Single rack**: The architecture supports multiple racks (topic prefix is parameterised), but the current deployment monitors only one rack.
- **No persistent history on restart**: The in-memory AppStore is lost when the backend restarts; Supabase is the persistent store but write failures are not retried.
- **No battery backup**: ESP8266 loses all state on power cut; cached readings (up to 120) are also lost.
- **No OTA firmware update**: Firmware changes require physical USB re-flashing.
- **Frontend only in English**: No Vietnamese localisation.

### Future Work

1. **Upgrade sensors** to DHT22 + capacitive soil sensor with temperature compensation.
2. **Expand to multiple racks** with per-rack dashboards.
3. **OTA firmware updates** using the Arduino OTA library or ESP-IDF.
4. **Edge AI enhancement**: Upgrade to a small LSTM model for anomaly prediction (predicting `critical` events 10–15 minutes in advance).
5. **Battery + solar backup** for remote deployments without reliable mains power.
6. **Supabase Row-Level Security** and field-level encryption for multi-tenant farm management.
7. **Vietnamese UI localisation**.
8. **Camera integration**: Add an ESP32-CAM for visual mould detection using a MobileNet-based classifier.

---

## 12. Team Contributions

| Student ID | Full Name | GitHub Username | Role | Main Contributions |
|---|---|---|---|---|
| *(to be filled)* | *(to be filled)* | *(to be filled)* | *(to be filled)* | *(to be filled)* |

---

## 13. References

1. Espressif Systems, "ESP8266 Technical Reference," espressif.com, 2023.
2. Aosong Electronics, "DHT11 Humidity & Temperature Sensor Datasheet," v1.3, 2022.
3. EMQX, "EMQX Cloud Documentation," docs.emqx.com, 2024.
4. F. Pedregosa et al., "Scikit-learn: Machine Learning in Python," *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011.
5. S. Hunkeler et al., "MQTT Version 5.0 OASIS Standard," OASIS, 2019.
6. Supabase, "Supabase Documentation," supabase.com, 2024.
7. T. Hunt and contributors, "FastAPI Documentation," fastapi.tiangolo.com, 2024.
8. React Team, "React Documentation," react.dev, 2024.
9. A. Misra, "Capacitive Soil Moisture Sensor v1.2 Documentation," DFRobot, 2021.
10. P. Rong, "Plant Disease and Health Dataset," *UCI Machine Learning Repository*, 2023.
