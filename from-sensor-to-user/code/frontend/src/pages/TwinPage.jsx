import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { HealthBadge } from '../components/ui/StageBadge'
import { Scene } from '../components/twin/Scene'
import { useGreenhouseSnapshot } from '../hooks/useGreenhouseData'

const STATUSES = ['healthy', 'warning', 'critical']

const MONO = "'JetBrains Mono',monospace"

function DataRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: color ?? '#1A261A' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function StatusDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: active ? '#16A34A' : '#D0D8D0',
      boxShadow: active ? '0 0 6px rgba(22,163,74,0.5)' : 'none',
      marginRight: 6,
      transition: 'all 0.3s',
    }} />
  )
}

// ─── Simulator Controls ───────────────────────────────────────────────────────

const DEFAULT_SIM = {
  air_temperature: 24,
  air_humidity:    80,
  soil_moisture:   60,
  status:          'healthy',
  fan:             false,
  pump:            true,
}

function SimSlider({ label, value, min, max, step = 0.5, unit, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: '#1A261A' }}>
          {Number(value).toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#16A34A', cursor: 'pointer', height: 3 }}
      />
    </div>
  )
}

function SimPanel({ sim, onChange }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      minWidth: 210,
      overflow: 'hidden',
    }}>
      {/* header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#D97706', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          ⚙ sim_mode active
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ height: 1, background: '#EAEDEA', marginBottom: 12 }} />

          <SimSlider label="air_temperature" value={sim.air_temperature} min={-20} max={80} unit="°C"
            onChange={(v) => onChange('air_temperature', v)} />
          <SimSlider label="air_humidity" value={sim.air_humidity} min={0} max={100} unit="%" step={1}
            onChange={(v) => onChange('air_humidity', v)} />
          <SimSlider label="soil_moisture" value={sim.soil_moisture} min={0} max={100} unit="%" step={1}
            onChange={(v) => onChange('soil_moisture', v)} />

          <div style={{ height: 1, background: '#EAEDEA', margin: '10px 0' }} />

          {/* status picker */}
          <p style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.08em', margin: '0 0 6px' }}>health_status</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {STATUSES.map((s) => (
              <button key={s} onClick={() => onChange('status', s)} style={{
                fontFamily: MONO, fontSize: 9, padding: '3px 7px', borderRadius: 6,
                border: `1px solid ${sim.status === s ? '#16A34A' : '#DDEADD'}`,
                background: sim.status === s ? '#F0FFF4' : 'transparent',
                color: sim.status === s ? '#16A34A' : '#9BB09B',
                cursor: 'pointer', letterSpacing: '0.04em',
              }}>{s}</button>
            ))}
          </div>

          {/* device toggles */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['fan', '#D97706'], ['pump', '#0891B2']].map(([key, color]) => (
              <button key={key} onClick={() => onChange(key, !sim[key])} style={{
                flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 700,
                padding: '5px 0', borderRadius: 7,
                border: `1px solid ${sim[key] ? color : '#DDEADD'}`,
                background: sim[key] ? color + '18' : 'transparent',
                color: sim[key] ? color : '#9BB09B',
                cursor: 'pointer', letterSpacing: '0.06em',
              }}>
                {key} {sim[key] ? 'ON' : 'OFF'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TwinPage() {
  const { environment, devices, ai } = useGreenhouseSnapshot()

  const [simMode, setSimMode] = useState(false)
  const [sim, setSim] = useState(DEFAULT_SIM)

  function handleSimChange(key, value) {
    setSim((prev) => ({ ...prev, [key]: value }))
  }

  const envData     = simMode ? sim                                          : environment
  const devData     = simMode ? { fan: sim.fan, pump: sim.pump }             : devices
  const aiData      = simMode ? { status: sim.status } : ai

  const temp   = envData?.air_temperature
  const hum    = envData?.air_humidity
  const fanOn  = devData?.fan  === true
  const pumpOn = devData?.pump === true

  const tempColor = temp == null ? '#9BB09B'
    : temp > 30 ? '#DC2626'
    : temp < 22 ? '#0891B2'
    : '#16A34A'

  const humColor = hum == null ? '#9BB09B'
    : hum < 70 ? '#D97706'
    : hum > 93 ? '#0891B2'
    : '#16A34A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="3d_twin" />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Scene environment={envData} devices={devData} ai={aiData} />

        {/* Floating data panel — top right */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 12,
          padding: '14px 16px',
          minWidth: 180,
          boxShadow: '0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
          pointerEvents: 'none',
        }}>
          <p style={{
            fontFamily: MONO,
            fontSize: 9, fontWeight: 700,
            color: '#9BB09B', letterSpacing: '0.14em',
            textTransform: 'uppercase',
            margin: '0 0 10px',
            paddingBottom: 8,
            borderBottom: '1px solid #EAEDEA',
          }}>
            {simMode ? 'sim data' : 'live data'}
          </p>

          <DataRow label="air_temp"     value={temp != null ? `${temp.toFixed(1)} °C` : null} color={tempColor} />
          <DataRow label="air_humidity" value={hum  != null ? `${hum.toFixed(1)} %`   : null} color={humColor}  />
          {envData?.soil_moisture != null && (
            <DataRow label="soil"
              value={`${envData.soil_moisture.toFixed(1)} %`}
              color={envData.soil_moisture < 40 ? '#D97706' : envData.soil_moisture > 85 ? '#0891B2' : '#16A34A'}
            />
          )}

          <div style={{ height: 1, background: '#EAEDEA', margin: '8px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['cooling fan', fanOn, devData, '#D97706'], ['water pump', pumpOn, devData, '#0891B2']].map(([label, on, src, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.06em' }}>{label}</span>
                <span style={{ display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 600, color: on ? color : '#9BB09B' }}>
                  <StatusDot active={on} />
                  {src == null ? '—' : on ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>

          {aiData?.status && (
            <>
              <div style={{ height: 1, background: '#EAEDEA', margin: '8px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B', letterSpacing: '0.06em' }}>health_status</span>
                <HealthBadge status={aiData.status} />
              </div>
            </>
          )}
        </div>

        {/* Sim mode toggle — top left */}
        <button
          onClick={() => setSimMode(m => !m)}
          style={{
            position: 'absolute', top: 16, left: 16,
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${simMode ? '#D97706' : '#DDEADD'}`,
            background: simMode ? 'rgba(217,119,6,0.10)' : 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: simMode ? '#D97706' : '#9BB09B',
            cursor: 'pointer', letterSpacing: '0.10em', textTransform: 'uppercase',
          }}
        >
          {simMode ? '● sim_mode' : '○ sim_mode'}
        </button>

        {/* Sim controls panel — bottom left */}
        {simMode && <SimPanel sim={sim} onChange={handleSimChange} />}

        {/* Hint — bottom center */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: MONO,
          fontSize: 10, color: '#9BB09B',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '5px 12px', borderRadius: 20,
          pointerEvents: 'none',
          letterSpacing: '0.06em',
        }}>
          drag to rotate · scroll to zoom
        </div>
      </div>
    </div>
  )
}
