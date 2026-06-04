import { useConnectionStatus } from '../../hooks/useGreenhouseData'
import { ConnectionStatus } from '../../store/useSocketStore'

const WS_MAP = {
  [ConnectionStatus.CONNECTING]:   { label: 'connecting', color: '#D97706', dot: '#FBBF24', glow: '0 0 6px rgba(251,191,36,0.5)' },
  [ConnectionStatus.CONNECTED]:    { label: 'live',       color: '#16A34A', dot: '#4ADE80', glow: '0 0 6px rgba(74,222,128,0.6)' },
  [ConnectionStatus.DISCONNECTED]: { label: 'offline',    color: '#9CA3AF', dot: '#9CA3AF', glow: 'none' },
  [ConnectionStatus.ERROR]:        { label: 'error',      color: '#DC2626', dot: '#F87171', glow: '0 0 6px rgba(248,113,113,0.5)' },
}

const MQTT_MAP = {
  connected:    { color: '#16A34A', dot: '#4ADE80', glow: '0 0 6px rgba(74,222,128,0.6)' },
  disconnected: { color: '#9CA3AF', dot: '#9CA3AF', glow: 'none' },
  error:        { color: '#DC2626', dot: '#F87171', glow: 'none' },
}

function Chip({ label, color, dot, glow }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      background: '#F5F6F8',
      border: `1px solid #E2E6E2`,
      borderRadius: 5,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10, fontWeight: 600,
      color, letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot,
        boxShadow: glow,
        flexShrink: 0,
      }} />
      {label}
    </span>
  )
}

export function ConnectionBadge() {
  const { status, mqttStatus } = useConnectionStatus()
  const ws   = WS_MAP[status]        ?? WS_MAP[ConnectionStatus.DISCONNECTED]
  const mqtt = MQTT_MAP[mqttStatus]  ?? MQTT_MAP.disconnected

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <Chip label={`ws:${ws.label}`}     color={ws.color}   dot={ws.dot}   glow={ws.glow}   />
      <Chip label={`mqtt:${mqttStatus}`} color={mqtt.color} dot={mqtt.dot} glow={mqtt.glow} />
    </div>
  )
}
