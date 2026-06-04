# 🍄 Mushroom Backend

Python backend cho Smart Mushroom Greenhouse Platform.  
Subscribe MQTT từ simulator (hoặc ESP32 thật) → push realtime xuống FE qua WebSocket.

## Setup

```bash
pip install -r requirements.txt
python main.py
```

Server chạy tại: http://localhost:8000

## Stack

| Layer | Library |
|---|---|
| HTTP framework | FastAPI |
| MQTT client | paho-mqtt |
| WebSocket / realtime | python-socketio (Socket.IO) |
| ASGI server | uvicorn |

## Architecture

```
MQTT Broker (broker.emqx.io)
    │ subscribe mushroom-farm/#
    ▼
paho-mqtt thread  ←── chạy blocking loop riêng
    │ on_message callback
    ▼
In-Memory Store   ←── latest state + deque history (200 records)
    │
    ├── REST API  ←── FE gọi khi load trang
    └── Socket.IO ←── push realtime mỗi khi có MQTT message
```

## REST Endpoints

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/state` | Latest state tất cả sensors |
| GET | `/api/health` | MQTT status + history counts |
| GET | `/api/history/environment?limit=100` | Lịch sử sensor |
| GET | `/api/history/devices?limit=100` | Lịch sử relay |
| GET | `/api/history/ai?limit=100` | Lịch sử AI stage |

## WebSocket (Socket.IO)

FE connect vào `ws://localhost:8000/socket.io`

Events nhận được:

```js
socket.on("state", (data) => {
  // data = { environment, devices, ai, last_updated, mqtt_status }
})
```

Mỗi khi MQTT nhận được message → backend emit "state" xuống tất cả client.

## Test nhanh

```bash
# Kiểm tra health
curl http://localhost:8000/api/health

# Xem latest state
curl http://localhost:8000/api/state

# Xem history sensor
curl http://localhost:8000/api/history/environment?limit=10
```

## Next Steps

- [ ] Frontend React + Three.js connect Socket.IO
- [ ] Auth (JWT) khi chuẩn bị deploy
- [ ] InfluxDB thay in-memory nếu cần persist history
- [ ] Alert logic (temp > 35°C → notify)
