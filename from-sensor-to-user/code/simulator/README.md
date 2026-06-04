# 🍄 Mushroom Simulator

Fake data generator cho Smart Mushroom Greenhouse Platform.  
Simulate sensor data + publish MQTT lên broker public — dùng để test backend và 3D dashboard.

## Setup

```bash
npm install
node index.js
```

Mở browser: http://localhost:3000

## MQTT Broker

Mặc định dùng **broker.emqx.io:1883** (public, free, không cần tài khoản).

Để đổi broker:
```bash
MQTT_BROKER=mqtt://your-broker:1883 node index.js
```

## MQTT Topics

| Topic | Payload |
|---|---|
| `mushroom-farm/rack-1/environment` | `{ temperature, humidity }` |
| `mushroom-farm/rack-1/devices` | `{ fan, mist }` |
| `mushroom-farm/rack-1/ai` | `{ stage, confidence }` |

## Test với MQTT CLI

```bash
# Subscribe để xem data
npx mqtt sub -h broker.emqx.io -t "mushroom-farm/#" -v
```

## Scenarios

| Scenario | Mô tả |
|---|---|
| `normal` | Điều kiện lý tưởng, nấm phát triển bình thường |
| `hot` | Nhiệt độ cao, fan bật liên tục |
| `dry` | Độ ẩm thấp, mist bật liên tục |
| `contamination` | AI stage bị lock ở `contaminated` |

## Fake Data Logic

- Humidity < 80% → mist tự bật
- Humidity > 93% hoặc Temp > 29°C → fan tự bật  
- Khi mist ON → humidity tăng nhanh
- Khi fan ON và humidity > 90% → humidity giảm
- AI stage tự tiến triển mỗi 8 ticks

## Next Steps

Sau khi simulator chạy ổn:

1. **Backend** — Node.js subscribe MQTT → forward qua WebSocket
2. **Frontend** — React + Three.js subscribe WebSocket → update 3D scene
3. **Hardware** — Thay simulator bằng ESP32 thật, giữ nguyên MQTT topics
