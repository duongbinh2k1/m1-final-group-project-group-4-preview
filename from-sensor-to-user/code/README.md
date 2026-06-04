# From Sensor to User — Code

This folder contains the complete source code for the **Smart Mushroom Greenhouse AIoT Platform**.

## Repository Structure

```
code/
├── edge_firmware/      ESP8266 firmware (C++/Arduino, PlatformIO)
├── ai_analytics/       ML model training scripts and exported C headers
├── backend/            Python FastAPI + Socket.IO backend
├── frontend/           React 18 + Vite web dashboard
├── simulator/          Node.js MQTT data simulator
└── README.md           (this file)
```

---

## Required Hardware / Software

### Hardware

| Component | Model |
|---|---|
| Microcontroller | ESP8266 NodeMCU v3 |
| Air sensor | DHT11 (temperature + humidity) |
| Soil moisture sensor | Capacitive v1.2 |
| Relay module | 2-channel 5 V active-LOW |
| Cooling fan | 12 V DC × 2 |
| Water pump | 5 V mini peristaltic |

### Software Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| PlatformIO Core | 6.x |
| Docker + Compose | 24+ (optional, for containerised deployment) |

### Accounts / Services

- **EMQX Cloud** — free tier (Southeast Asia); provides the MQTT broker.
- **Supabase** — free tier; provides the PostgreSQL database.

---

## Installation

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MQTT_BROKER, SUPABASE_URL, SUPABASE_KEY, JWT_SECRET
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: set VITE_BACKEND_URL=http://localhost:8000
npm install
```

### 3. Simulator (optional — if no physical hardware)

```bash
cd simulator
npm install
cp .env.example .env  # or edit index.js MQTT settings directly
```

### 4. Edge Firmware

```bash
cd edge_firmware
# Edit include/config.h:
#   MQTT_HOST, MQTT_USER, MQTT_PASSWORD
# Edit include/certs.h:
#   Paste EMQX Cloud CA certificate
pio run --target upload
```

---

## How to Run

### Option A — Full stack with Docker

```bash
# From the project root (one level up from code/)
docker compose up --build
```

Services exposed:
- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173` (dev) or `http://localhost:80` (nginx)

### Option B — Manual (development)

**Terminal 1 — Backend**
```bash
cd backend
python main.py
# Server starts at http://localhost:8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# App at http://localhost:5173
```

**Terminal 3 — Simulator** (if no ESP8266 hardware)
```bash
cd simulator
node index.js
```

---

## Main Files

| File | Description |
|---|---|
| `edge_firmware/src/main.cpp` | ESP8266 main loop — sensor read, AI classify, MQTT publish, relay control |
| `edge_firmware/include/config.h` | Hardware pin mapping, MQTT settings, safety thresholds |
| `edge_firmware/include/plant_classifier.h` | Auto-generated Decision Tree C code — plant health classification |
| `edge_firmware/include/actuator_classifier.h` | Auto-generated Decision Tree C code — actuator decision |
| `ai_analytics/train_actuator_model.py` | Train actuator classifier and export C header |
| `ai_analytics/notebooks/` | Jupyter notebooks for EDA, training, and export |
| `backend/main.py` | FastAPI + Socket.IO application entry point |
| `backend/app/services/mqtt.py` | MQTT subscriber thread |
| `backend/app/core/store.py` | In-memory AppStore (deques) |
| `backend/app/services/broadcaster.py` | Socket.IO server and emit helper |
| `frontend/src/App.jsx` | Root layout and routing |
| `frontend/src/hooks/useSocket.js` | Socket.IO lifecycle hook |
| `frontend/src/store/useGreenhouseStore.js` | Zustand store for sensor data and history |
| `frontend/src/pages/TwinPage.jsx` | 3D digital twin with Three.js |
| `simulator/index.js` | MQTT synthetic data publisher |

---

## Environment Variables

### Backend (`backend/.env`)

```env
MQTT_BROKER=ace2ba13.ala.asia-southeast1.emqxsl.com
MQTT_PORT=8883
MQTT_TOPIC_PREFIX=mushroom-farm
MQTT_USER=mushroom-esp8266
MQTT_PASSWORD=mushroom-esp8266
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
JWT_SECRET=change-me-in-production
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
VITE_BACKEND_URL=http://localhost:8000
```

---

## Demo Notes

- The **simulator** publishes realistic time-series data including a temperature spike scenario to demonstrate the `healthy → warning → critical` transition.
- The **3D digital twin** on the TwinPage reflects the current health status colour and animates fans when the relay is ON.
- The **Control page** allows switching between OFF / AUTO / MANUAL modes and issuing direct actuator commands.
- The **AI page** shows the classification history chart with colour-coded stage badges.
- Login credentials for the demo backend: `admin / admin123` (change before production deployment).
