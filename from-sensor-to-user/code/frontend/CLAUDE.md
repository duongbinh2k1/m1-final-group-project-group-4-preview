# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Mushroom Greenhouse Platform — a full-stack IoT dashboard. The frontend (React + Vite) communicates with a Python FastAPI backend over REST and Socket.IO. The backend bridges MQTT sensor data into the web UI in real time.

## Commands

### Frontend (this directory)
```bash
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build
npm run preview    # Preview production build
```

### Backend (`../backend/`)
```bash
python main.py     # Uvicorn at http://localhost:8000
```

## Architecture

### Data Flow
```
MQTT Broker (broker.emqx.io)
  ↓ paho-mqtt background thread
AppStore (in-memory deques, 200 records max per topic)
  ├─ REST API   → called once on frontend connect to seed chart history
  └─ Socket.IO  → broadcasts "state" event on every MQTT message
       ↓
Zustand stores (greenhouse data + socket status)
  ↓
React pages/components
```

### Frontend

- **State**: Two Zustand stores — `useGreenhouseStore` (latest sensor snapshot + 200-record history arrays) and `useSocketStore` (connection status string).
- **Socket lifecycle**: `useSocket()` hook (called once in `App.jsx`) creates the singleton Socket.IO connection, fetches REST history to pre-fill charts, then wires all `"state"` events to the store.
- **Selectors**: `useGreenhouseData.js` exports fine-grained selector hooks so components only re-render on the slice they need.
- **Services**: `api.js` — thin fetch wrappers for REST; `socket.js` — Socket.IO singleton (not React — shared module instance).
- **Pages**: Dashboard (overview cards + AI stage), Environment (air temp/humidity/soil charts), Devices (relay toggles), TwinPage (3D digital twin with sim_mode toggle).

### Backend (`../backend/`)

- **Entry**: `main.py` creates the FastAPI app and wraps it with python-socketio as an ASGI app. `run.py` starts uvicorn.
- **MQTT thread**: `app/services/mqtt.py` — daemon thread running paho-mqtt loop; parses JSON payloads into Pydantic models; writes to AppStore; triggers `broadcaster.py` to emit over Socket.IO.
- **AppStore** (`app/core/store.py`): singleton with `latest_*` fields and `collections.deque(maxlen=200)` per topic.
- **REST routes** (`app/api/routes/`): `health.py`, `environment.py`, `devices.py`, `ai.py` — all read from AppStore.
- **Lifecycle** (`app/core/events.py`): FastAPI `lifespan` startup hook spawns the MQTT thread.

## Key Files

| File | Role |
|------|------|
| `src/App.jsx` | Root layout — Sidebar + router outlet, calls `useSocket()` |
| `src/router.jsx` | 4 routes mapped to page components |
| `src/store/useGreenhouseStore.js` | Latest data + 200-record history |
| `src/store/useSocketStore.js` | WebSocket connection status |
| `src/hooks/useSocket.js` | Socket connection + REST seeding + event wiring |
| `src/services/socket.js` | Socket.IO singleton module |
| `src/services/api.js` | REST fetch helpers |
| `../backend/app/core/store.py` | In-memory AppStore (deques) |
| `../backend/app/services/mqtt.py` | MQTT client thread |
| `../backend/app/services/broadcaster.py` | Socket.IO server + emit |
| `../backend/app/models/schemas.py` | Pydantic models for all three topics |
| `../backend/app/models/enums.py` | `HealthStatus` enum, `MQTTStatus` enum |

## Environment Variables

**Backend** (`../backend/.env`):
```
MQTT_BROKER=broker.emqx.io
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=mushroom-farm
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend** (`.env.local`):
```
VITE_BACKEND_URL=http://localhost:8000
```

## REST API Reference

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | MQTT status, history record counts |
| `GET /api/state` | Latest snapshot: environment + devices + ai |
| `GET /api/environment/history?limit=N` | air_temperature/air_humidity/soil_moisture history array |
| `GET /api/devices/history?limit=N` | Fan/mist relay history array |
| `GET /api/ai/history?limit=N` | AI stage classification history |

## WebSocket Events

Connect to `http://localhost:8000` (Socket.IO path).

**Received event: `"state"`**
```json
{
  "environment": {
    "timestamp": 1716288000.0,
    "air_temperature": 24.5,
    "air_humidity": 78.2,
    "soil_moisture": 62.0
  },
  "devices": { "fan": true, "mist": false },
  "ai": { "status": "healthy" },
  "last_updated": "2026-05-21T10:00:00Z",
  "mqtt_status": "connected"
}
```
Emitted on every MQTT message and immediately when a new client connects.

## MQTT Topics & Payload Format

Topic pattern: `{MQTT_TOPIC_PREFIX}/rack-1/{category}`

```json
// mushroom-farm/rack-1/environment
{
  "timestamp": 1716288000,
  "air_temperature": 24.5,
  "air_humidity": 78.2,
  "soil_moisture": 62.0
}

// mushroom-farm/rack-1/devices
{ "fan": true, "mist": false }

// mushroom-farm/rack-1/ai
{ "status": "healthy" }
```

Valid `status` values: `healthy`, `warning`, `critical`

## UI Design Tokens

Dark theme (Slate 900 background). Color coding for sensor states:
- Green `#4ADE80` — optimal / active
- Amber `#FBBF24` — warning
- Cyan `#22D3EE` — humidity indicator
- Red `#F87171` — alert

Fonts: JetBrains Mono for live data values, Inter for body text.

## Current Limitations

- No database — data is in-memory only; history lost on backend restart
- No auth layer
- No test suite (neither vitest nor pytest is configured)
