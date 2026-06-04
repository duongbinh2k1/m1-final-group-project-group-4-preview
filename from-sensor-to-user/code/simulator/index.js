require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── MQTT Config ────────────────────────────────────────────────────
const TOPIC_PREFIX  = process.env.MQTT_TOPIC_PREFIX || 'mushroom-farm';
const TOPIC_ENV     = `${TOPIC_PREFIX}/rack-1/environment`;
const TOPIC_DEVICES = `${TOPIC_PREFIX}/rack-1/devices`;
const TOPIC_AI      = `${TOPIC_PREFIX}/rack-1/ai`;

let mqttClient = null;
let mqttStatus = 'disconnected';

function connectMQTT() {
  const host     = process.env.MQTT_BROKER   || 'broker.emqx.io';
  const port     = parseInt(process.env.MQTT_PORT || '1883');
  const username = process.env.MQTT_USERNAME || '';
  const password = process.env.MQTT_PASSWORD || '';
  const caPath   = process.env.MQTT_CA_CERT  || '';

  const protocol = port === 8883 ? 'mqtts' : 'mqtt';
  const brokerUrl = `${protocol}://${host}:${port}`;

  const options = {
    clientId: `mushroom-simulator-${Date.now()}`,
    reconnectPeriod: 3000,
    ...(username && { username, password }),
    ...(port === 8883 && {
      tls: true,
      ca: caPath ? require('fs').readFileSync(require('path').resolve(__dirname, caPath)) : undefined,
      rejectUnauthorized: !!caPath,
    }),
  };

  console.log(`[MQTT] Connecting to ${brokerUrl} (user: ${username || 'anonymous'})...`);
  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on('connect', () => {
    mqttStatus = 'connected';
    console.log('[MQTT] Connected ✓');
  });

  mqttClient.on('error', (err) => {
    mqttStatus = 'error';
    console.error('[MQTT] Error:', err.message);
  });

  mqttClient.on('close', () => {
    mqttStatus = 'disconnected';
  });
}

connectMQTT();

// ─── Fake Data Generator ─────────────────────────────────────────────
const STAGES = ['pinning', 'growing', 'growing', 'growing', 'mature', 'mature', 'overgrown', 'contaminated'];

const SCENARIOS = {
  normal:        { tempBase: 26, tempRange: 2, humBase: 85, humRange: 5 },
  hot:           { tempBase: 33, tempRange: 2, humBase: 70, humRange: 5 },
  dry:           { tempBase: 26, tempRange: 2, humBase: 55, humRange: 8 },
  contamination: { tempBase: 28, tempRange: 1, humBase: 90, humRange: 3 },
};

const state = {
  temp: 26.0,
  hum: 85.0,
  soil: 60.0,
  fan: false,
  mist: false,
  stageIdx: 2,
  tick: 0,
  scenario: 'normal',
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(range) { return (Math.random() - 0.5) * 2 * range; }
function lerp(a, b, t) { return a + (b - a) * t; }

function generateTick() {
  const scenario = SCENARIOS[state.scenario] || SCENARIOS.normal;
  state.tick++;

  state.temp = clamp(
    lerp(state.temp, scenario.tempBase + rand(scenario.tempRange), 0.3) + rand(0.3),
    15, 40
  );

  if (state.mist) {
    state.hum  = clamp(state.hum + 0.8 + Math.random() * 0.5, 60, 98);
    state.soil = clamp(state.soil + 0.4 + Math.random() * 0.3, 30, 90);
  } else {
    state.hum  = clamp(
      lerp(state.hum, scenario.humBase + rand(scenario.humRange), 0.15) + rand(0.5),
      40, 98
    );
    state.soil = clamp(state.soil - 0.2 + rand(0.1), 30, 90);
  }

  state.fan  = state.temp > 29 || state.hum > 93;
  state.mist = state.hum < 80;
  if (state.fan && state.hum > 90) state.hum -= 0.3;

  if (state.tick % 8 === 0) {
    if (state.scenario === 'contamination') {
      state.stageIdx = 7;
    } else {
      state.stageIdx = clamp(state.stageIdx + (Math.random() > 0.7 ? 1 : 0), 0, 6);
    }
  }

  return {
    environment: {
      timestamp:       Math.floor(Date.now() / 1000),
      air_temperature: parseFloat(state.temp.toFixed(1)),
      air_humidity:    parseFloat(state.hum.toFixed(1)),
      soil_moisture:   parseFloat(state.soil.toFixed(1)),
    },
    devices: {
      fan:  state.fan,
      mist: state.mist,
    },
    ai: {
      stage:      STAGES[state.stageIdx],
      confidence: parseFloat((0.82 + Math.random() * 0.16).toFixed(2)),
    },
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ─── Generator Loop ──────────────────────────────────────────────────
let genTimer = null;
let intervalMs = 1000;
let isRunning = false;
let lastPayload = null;
const logHistory = [];

function publishTick() {
  const data = generateTick();
  lastPayload = data;

  const logEntry = { ...data, mqttStatus };
  logHistory.unshift(logEntry);
  if (logHistory.length > 100) logHistory.pop();

  if (mqttClient && mqttStatus === 'connected') {
    mqttClient.publish(TOPIC_ENV,     JSON.stringify(data.environment), { qos: 0 });
    mqttClient.publish(TOPIC_DEVICES, JSON.stringify(data.devices),     { qos: 0 });
    mqttClient.publish(TOPIC_AI,      JSON.stringify(data.ai),          { qos: 0 });
  }

  console.log(`[TICK] ${data.timestamp} | ${data.environment.air_temperature}°C ${data.environment.air_humidity}% soil:${data.environment.soil_moisture}% | stage: ${data.ai.stage} | mqtt: ${mqttStatus}`);
}

// ─── API Routes ──────────────────────────────────────────────────────
app.post('/api/start', (req, res) => {
  const { interval, scenario } = req.body;
  if (interval) intervalMs = Math.max(500, Math.min(10000, parseInt(interval)));
  if (scenario) state.scenario = scenario;

  if (!isRunning) {
    isRunning = true;
    publishTick();
    genTimer = setInterval(publishTick, intervalMs);
  }

  res.json({ ok: true, isRunning, intervalMs, scenario: state.scenario });
});

app.post('/api/stop', (req, res) => {
  if (genTimer) clearInterval(genTimer);
  genTimer = null;
  isRunning = false;
  res.json({ ok: true, isRunning });
});

app.post('/api/scenario', (req, res) => {
  const { scenario } = req.body;
  if (SCENARIOS[scenario]) state.scenario = scenario;
  res.json({ ok: true, scenario: state.scenario });
});

app.post('/api/interval', (req, res) => {
  const { interval } = req.body;
  intervalMs = Math.max(500, Math.min(10000, parseInt(interval)));
  if (isRunning) {
    clearInterval(genTimer);
    genTimer = setInterval(publishTick, intervalMs);
  }
  res.json({ ok: true, intervalMs });
});

app.get('/api/status', (req, res) => {
  res.json({
    isRunning,
    intervalMs,
    scenario: state.scenario,
    mqttStatus,
    mqttBroker: MQTT_BROKER,
    topics: { env: TOPIC_ENV, devices: TOPIC_DEVICES, ai: TOPIC_AI },
    lastPayload,
    tick: state.tick,
  });
});

app.get('/api/log', (req, res) => {
  res.json(logHistory.slice(0, 50));
});

// ─── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍄  Mushroom Simulator running at http://localhost:${PORT}`);
  console.log(`📡  MQTT Broker: ${process.env.MQTT_BROKER || 'broker.emqx.io'}:${process.env.MQTT_PORT || 1883}`);
  console.log(`📦  Topics:`);
  console.log(`    ${TOPIC_ENV}`);
  console.log(`    ${TOPIC_DEVICES}`);
  console.log(`    ${TOPIC_AI}\n`);
});
