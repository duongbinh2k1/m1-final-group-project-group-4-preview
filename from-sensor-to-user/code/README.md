# From Sensor to User — Code

Source code for the **Smart Mushroom Greenhouse AIoT Platform** — Group 4.

## Repository Structure

```
code/
├── edge_firmware/      ESP8266 firmware (C++/Arduino, PlatformIO)
├── ai_analytics/       ML model training scripts and exported C headers
├── backend/            Python FastAPI + Socket.IO backend
├── frontend/           React 18 + Vite web dashboard
├── mobile/             React Native + Expo mobile app (Android/iOS)
├── scripts/            Database setup scripts (Supabase SQL)
└── README.md           (this file)
```

---

## Hardware

| Component | Model |
|---|---|
| Microcontroller | ESP8266 NodeMCU v3 |
| Air sensor | DHT11 (temperature + humidity) |
| Soil moisture sensor | Capacitive v1.2 |
| Relay module | 2-channel 5 V active-LOW |
| Cooling fan | 12 V DC × 2 |
| Water pump | 5 V mini peristaltic |

---

## Software Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| PlatformIO Core | 6.x |
| Expo CLI / EAS CLI | latest |
| Docker + Compose | 24+ (optional) |

### External Services

- **EMQX Cloud** — MQTT broker (Southeast Asia region, TLS port 8883)
- **Supabase** — PostgreSQL database (free tier)

---

## Installation

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASSWORD,
#            SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
pip install -r requirements.txt
```

Run Supabase schema once (in Supabase SQL Editor):

```bash
# paste contents of scripts/supabase_setup.sql
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: set VITE_BACKEND_URL=http://localhost:8000
npm install
```

### 3. Mobile

```bash
cd mobile
npm install
# Edit src/services/api.js and src/services/socket.js:
#   set BASE_URL to your backend address
```

### 4. Edge Firmware

```bash
cd edge_firmware
# Edit include/config.h: set MQTT_HOST
# Edit include/certs.h:  set EMQX_CA_CERT, DEVICE_CERT, DEVICE_KEY (see X.509 section below)
pio run --target upload
```

---

## X.509 Mutual TLS (mTLS) Setup

The firmware authenticates to the MQTT broker using **client certificates** instead of
username/password. This provides device-level identity — each rack has a unique
certificate; a compromised credential cannot be trivially reused on another device.

> **Broker requirement**: mTLS requires EMQX Cloud **Dedicated** or a self-hosted EMQX
> instance. EMQX Cloud Serverless (free tier) supports server-side TLS only.
> The firmware code is correct and activates mTLS automatically when the broker supports it.
> For Serverless deployments, revert `reconnectMQTT()` to use `connect(id, user, pass)`.

### Step 1 — Create a farm CA (once per farm)

```bash
mkdir -p certs && cd certs

# Farm Certificate Authority
openssl genrsa -out farm-ca.key 2048
openssl req -x509 -new -nodes -key farm-ca.key -sha256 -days 3650 \
  -out farm-ca.crt \
  -subj "/CN=MushroomFarm-CA/O=MushroomFarm"
```

### Step 2 — Issue a device certificate (once per rack)

```bash
# Replace "rack-1" with the actual rack ID
openssl genrsa -out rack-1.key 2048
openssl req -new -key rack-1.key -out rack-1.csr \
  -subj "/CN=rack-1/O=MushroomFarm"
openssl x509 -req -in rack-1.csr \
  -CA farm-ca.crt -CAkey farm-ca.key -CAcreateserial \
  -out rack-1.crt -days 3650 -sha256

# Verify
openssl verify -CAfile farm-ca.crt rack-1.crt
```

### Step 3 — Configure EMQX broker

1. Go to **EMQX Dashboard → TLS/SSL → Enable Mutual TLS**
2. Upload `farm-ca.crt` as the trusted CA
3. EMQX will now require every connecting device to present a cert signed by this CA
4. The CN field (`rack-1`) is used as the device identity — no username/password needed

### Step 4 — Paste certs into firmware

Open `edge_firmware/include/certs.h` and fill in the two placeholders:

```bash
cat rack-1.crt   # copy the entire output including BEGIN/END lines
cat rack-1.key   # copy the entire output — keep this secret
```

```cpp
// certs.h
static const char DEVICE_CERT[] = R"EOF(
-----BEGIN CERTIFICATE-----
<paste rack-1.crt here>
-----END CERTIFICATE-----
)EOF";

static const char DEVICE_KEY[] = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
<paste rack-1.key here>
-----END RSA PRIVATE KEY-----
)EOF";
```

### Step 5 — Flash and verify

```bash
cd edge_firmware
pio run --target upload

# Test from your machine (requires mosquitto-clients)
mosquitto_pub \
  --cafile certs/farm-ca.crt \
  --cert   certs/rack-1.crt \
  --key    certs/rack-1.key \
  -h <YOUR_EMQX_HOST> -p 8883 \
  -t "mushroom-farm/rack-1/environment" \
  -m '{"test":1}' --tls-version tlsv1.2
```

### Security notes

| | Username/Password | X.509 mTLS |
|---|---|---|
| Identity proof | string in firmware | cryptographic certificate |
| Revoke a device | not possible | delete cert on broker |
| Blast radius if key leaked | all devices share same creds | one rack only |
| Requires | nothing extra | Dedicated broker / self-hosted |

> ⚠️ **Never commit `rack-1.key` to git.**
> Add `certs/*.key` to `.gitignore`. The `DEVICE_KEY` string in `certs.h` is compiled
> into the binary — treat the `.h` file as sensitive and do not push to a public repo.

---

## How to Run

### Option A — Docker (full stack)

```bash
# From the code/ directory
docker compose up --build
```

- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173` (dev) / `http://localhost:80` (nginx)

### Option B — Manual (development)

**Terminal 1 — Backend**
```bash
cd backend && python main.py
```

**Terminal 2 — Frontend**
```bash
cd frontend && npm run dev
```

**Terminal 3 — Mobile**
```bash
cd mobile && npx expo start
# Scan QR with Expo Go app, or press A (Android) / I (iOS)
```

---

## Key Files

| File | Description |
|---|---|
| `edge_firmware/src/main.cpp` | ESP8266 main loop — sensor read, AI classify, MQTT publish, relay control |
| `edge_firmware/include/config.h` | Pin mapping, MQTT settings, safety thresholds, intervals |
| `edge_firmware/include/plant_classifier.h` | Auto-generated Decision Tree C code — plant health classification |
| `edge_firmware/include/actuator_classifier.h` | Auto-generated Decision Tree C code — actuator decision |
| `ai_analytics/train_actuator_model.py` | Train actuator classifier and export C header |
| `ai_analytics/notebooks/` | Jupyter notebooks for EDA, training, and export |
| `backend/main.py` | FastAPI + Socket.IO application entry point |
| `backend/app/services/mqtt.py` | MQTT subscriber thread |
| `backend/app/core/store.py` | In-memory AppStore (deques, 200 records each) |
| `backend/app/services/broadcaster.py` | Socket.IO server and emit helper |
| `backend/app/core/auth.py` | JWT + bcrypt authentication |
| `backend/app/services/supabase_db.py` | Supabase REST API client |
| `frontend/src/App.jsx` | Root layout and routing |
| `frontend/src/hooks/useSocket.js` | Socket.IO lifecycle hook |
| `frontend/src/store/useGreenhouseStore.js` | Zustand store for sensor data and history |
| `frontend/src/pages/TwinPage.jsx` | 3D digital twin (Three.js) |
| `mobile/App.js` | Root component and bottom tab navigator |
| `mobile/src/hooks/useSocket.js` | Socket.IO lifecycle hook (shared pattern with web) |
| `mobile/src/screens/ControlScreen.jsx` | Remote control with sliders and pump countdown timer |
| `scripts/supabase_setup.sql` | Schema: environment_readings, device_states, ai_readings, users |

---

## Environment Variables

### Backend (`backend/.env`)

```env
MQTT_BROKER=your-emqx-broker-host
MQTT_PORT=8883
MQTT_TOPIC_PREFIX=mushroom-farm
MQTT_USER=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
VITE_BACKEND_URL=http://localhost:8000
```

---

## MQTT Topics

| Topic | Direction | Content |
|---|---|---|
| `mushroom-farm/rack-1/environment` | ESP8266 → broker | Temperature, humidity, soil moisture |
| `mushroom-farm/rack-1/ai` | ESP8266 → broker | Plant health classification |
| `mushroom-farm/rack-1/devices` | ESP8266 → broker | Relay states (fan, pump) |
| `mushroom-farm/rack-1/config` | broker → ESP8266 | Operating mode + thresholds |
| `mushroom-farm/rack-1/command` | broker → ESP8266 | Manual actuator override commands |

---

## Demo

- Demo video: [Google Drive](https://drive.google.com/drive/folders/1_42zt6ASI6IfoidNQdpF8oxOjGNOkwT4)
- Login credentials (demo backend): `admin / admin123` — change before production deployment.
