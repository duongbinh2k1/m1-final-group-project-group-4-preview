import { useEffect, useRef, useState } from 'react'
import { Header } from '../components/layout/Header'
import { api } from '../services/api'
import { useGreenhouseStore } from '../store/useGreenhouseStore'

const MONO = "'JetBrains Mono',monospace"
const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

const MODES = [
  {
    key: 'off',
    label: 'OFF',
    desc: 'All actuators forced off. Classifier ignored.',
    color: '#DC2626',
    bg:   'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.25)',
  },
  {
    key: 'auto',
    label: 'AUTO',
    desc: 'ML classifier decides pump and fan automatically.',
    color: '#16A34A',
    bg:   'rgba(22,163,74,0.07)',
    border: 'rgba(22,163,74,0.25)',
  },
  {
    key: 'manual',
    label: 'MANUAL',
    desc: 'Custom thresholds override the classifier.',
    color: '#D97706',
    bg:   'rgba(217,119,6,0.07)',
    border: 'rgba(217,119,6,0.25)',
  },
]

const PUMP_DURATIONS = [
  { label: '30s',  value: 30  },
  { label: '1 min', value: 60  },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min',value: 600 },
]

const DEFAULT_THRESHOLDS = {
  temp_fan_on:     30.0,
  humidity_fan_on: 50.0,
  soil_pump_on:    25.0,
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: 10, fontWeight: 600,
      color: '#9BB09B', letterSpacing: '0.12em',
      textTransform: 'uppercase', margin: '0 0 12px',
      paddingBottom: 8, borderBottom: '1px solid #EAEDEA',
    }}>
      {children}
    </p>
  )
}

function ThresholdSlider({ label, hint, value, min, max, step = 0.5, unit, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#1A261A' }}>
            {label}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: '#9BB09B', marginLeft: 8 }}>
            {hint}
          </span>
        </div>
        <span style={{
          fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#1A261A',
          minWidth: 56, textAlign: 'right',
        }}>
          {Number(value).toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#D97706', cursor: 'pointer', height: 4 }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontFamily: MONO, fontSize: 9, color: '#C0D0C0',
      }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export function ControlPage() {
  const storeControl = useGreenhouseStore((s) => s.control)

  const [mode,       setMode]       = useState('auto')
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading,    setLoading]    = useState(false)
  const [status,     setStatus]     = useState(null)  // null | 'ok' | 'warn' | 'error'
  const [statusMsg,  setStatusMsg]  = useState('')

  // Remote control toggle state
  // null = released to mode, true = CMD_ON, false = CMD_OFF
  const [fanOn,       setFanOn]       = useState(null)
  const [pumpOn,      setPumpOn]      = useState(null)
  const [pumpDur,     setPumpDur]     = useState(120)   // seconds
  const [pumpCountdown, setPumpCountdown] = useState(0) // seconds remaining
  const countdownRef = useRef(null)

  // Always fetch REST on mount for fresh config (source of truth)
  useEffect(() => {
    api.getControl()
      .then((d) => {
        setMode(d.mode)
        setThresholds({ ...DEFAULT_THRESHOLDS, ...d.thresholds })
      })
      .catch(() => {
        // REST failed — fall back to Socket.IO store if available
        if (storeControl) {
          setMode(storeControl.mode)
          setThresholds({ ...DEFAULT_THRESHOLDS, ...storeControl.thresholds })
        } else {
          setStatus('error')
          setStatusMsg('Could not load config — backend unreachable.')
          setTimeout(() => setStatus(null), 5000)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync realtime updates from Socket.IO (another client changed config)
  useEffect(() => {
    if (!storeControl) return
    setMode(storeControl.mode)
    setThresholds({ ...DEFAULT_THRESHOLDS, ...storeControl.thresholds })
  }, [storeControl])

  function handleThreshold(key, value) {
    setThresholds((prev) => ({ ...prev, [key]: value }))
  }

  // Fan toggle: null→ON, ON→OFF, OFF→null (cycle through states)
  async function handleFanToggle() {
    const next = fanOn === null ? true : fanOn === true ? false : null
    const prev = fanOn
    setFanOn(next)
    try {
      // state: null → backend excludes key → firmware gets CMD_NONE (release to mode)
      // state: true/false → CMD_ON / CMD_OFF
      await api.sendCommand({ device: 'fan', state: next })
    } catch (err) {
      setFanOn(prev)
      setStatus('error')
      setStatusMsg(`Fan command failed: ${err?.detail ?? 'MQTT offline'}`)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  // Pump toggle: null→ON (with timer), ON→OFF, OFF→null
  async function handlePumpToggle() {
    const next = pumpOn === null ? true : pumpOn === true ? false : null
    const prev = pumpOn
    setPumpOn(next)
    clearInterval(countdownRef.current)

    if (next === true) {
      setPumpCountdown(pumpDur)
      countdownRef.current = setInterval(() => {
        setPumpCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current)
            // Release to mode (not force-off) — firmware does the same
            setPumpOn(null)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } else {
      setPumpCountdown(0)
    }

    try {
      await api.sendCommand({
        device: 'pump',
        state: next,   // null → CMD_NONE (release), true → CMD_ON, false → CMD_OFF
        ...(next === true && { duration: pumpDur }),
      })
    } catch (err) {
      setPumpOn(prev)
      clearInterval(countdownRef.current)
      setPumpCountdown(0)
      setStatus('error')
      setStatusMsg(`Pump command failed: ${err?.detail ?? 'MQTT offline'}`)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  // Cleanup countdown on unmount
  useEffect(() => () => clearInterval(countdownRef.current), [])

  async function handleApply() {
    setLoading(true)
    setStatus(null)
    try {
      const payload = { mode, thresholds }
      const res = await api.setControl(payload)
      if (res._mqttDown) {
        setStatus('warn')
        setStatusMsg('Config saved — MQTT offline, firmware will receive it on reconnect.')
      } else {
        setStatus('ok')
        setStatusMsg('Config applied. Firmware updated.')
      }
    } catch {
      setStatus('error')
      setStatusMsg('Failed to apply config. Check backend connection.')
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  const activeMode = MODES.find((m) => m.key === mode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="control" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        {/* Remote control toggles */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// remote_control</SectionLabel>
          <div style={{ ...CARD, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Fan toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#1A261A', margin: '0 0 2px' }}>
                  cooling_fan
                </p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#9BB09B', margin: 0 }}>
                  Toggle regardless of mode — no auto-off
                </p>
              </div>
              <button
                onClick={handleFanToggle}
                style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.10em', padding: '8px 20px', borderRadius: 6,
                  border: `2px solid ${fanOn === true ? 'rgba(217,119,6,0.35)' : fanOn === false ? 'rgba(220,38,38,0.30)' : '#DDEADD'}`,
                  background: fanOn === true ? 'rgba(217,119,6,0.10)' : fanOn === false ? 'rgba(220,38,38,0.07)' : '#F5F6F8',
                  color: fanOn === true ? '#D97706' : fanOn === false ? '#DC2626' : '#9BB09B',
                  cursor: 'pointer', transition: 'all 0.18s', minWidth: 90,
                }}
              >
                {fanOn === true ? '▲ FORCE ON' : fanOn === false ? '▼ FORCE OFF' : '— AUTO'}
              </button>
            </div>

            <div style={{ height: 1, background: '#EAEDEA' }} />

            {/* Pump toggle + duration */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#1A261A', margin: '0 0 2px' }}>
                  water_pump
                </p>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#9BB09B', margin: '0 0 10px' }}>
                  Auto-off after selected duration
                </p>
                {/* Duration selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PUMP_DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => { if (!pumpOn) setPumpDur(d.value) }}
                      disabled={pumpOn}
                      style={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 5,
                        border: `1px solid ${pumpDur === d.value ? '#0891B2' : '#DDEADD'}`,
                        background: pumpDur === d.value ? 'rgba(8,145,178,0.08)' : 'transparent',
                        color: pumpDur === d.value ? '#0891B2' : '#9BB09B',
                        cursor: pumpOn ? 'not-allowed' : 'pointer',
                        opacity: pumpOn ? 0.5 : 1,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <button
                  onClick={handlePumpToggle}
                  style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.10em', padding: '8px 20px', borderRadius: 6,
                    border: `2px solid ${pumpOn === true ? 'rgba(8,145,178,0.35)' : pumpOn === false ? 'rgba(220,38,38,0.30)' : '#DDEADD'}`,
                    background: pumpOn === true ? 'rgba(8,145,178,0.10)' : pumpOn === false ? 'rgba(220,38,38,0.07)' : '#F5F6F8',
                    color: pumpOn === true ? '#0891B2' : pumpOn === false ? '#DC2626' : '#9BB09B',
                    cursor: 'pointer', transition: 'all 0.18s', minWidth: 90,
                  }}
                >
                  {pumpOn === true ? '▲ FORCE ON' : pumpOn === false ? '▼ FORCE OFF' : '— AUTO'}
                </button>
                {pumpOn === true && pumpCountdown > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#0891B2' }}>
                    auto-off {pumpCountdown < 60
                      ? `${pumpCountdown}s`
                      : `${Math.floor(pumpCountdown / 60)}m ${pumpCountdown % 60}s`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Mode selector */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// actuator_mode</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {MODES.map((m) => {
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  style={{
                    ...CARD,
                    padding: '20px 16px',
                    border: `2px solid ${active ? m.border : 'transparent'}`,
                    background: active ? m.bg : '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.18s',
                    outline: 'none',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: active ? m.color : '#C0D0C0',
                      boxShadow: active ? `0 0 6px ${m.color}` : 'none',
                      transition: 'all 0.2s', flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: MONO, fontSize: 12, fontWeight: 700,
                      color: active ? m.color : '#9BB09B',
                      letterSpacing: '0.10em',
                    }}>
                      {m.label}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: "'Inter',sans-serif", fontSize: 12,
                    color: active ? '#1A261A' : '#9BB09B',
                    margin: 0, lineHeight: 1.5,
                  }}>
                    {m.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Manual thresholds — only shown in manual mode */}
        {mode === 'manual' && (
          <section style={{ marginBottom: 28 }}>
            <SectionLabel>// manual_thresholds</SectionLabel>
            <div style={{ ...CARD, padding: '24px 28px' }}>
              <ThresholdSlider
                label="temp_fan_on"
                hint="fan turns ON above"
                value={thresholds.temp_fan_on}
                min={15} max={45} step={0.5} unit="°C"
                onChange={(v) => handleThreshold('temp_fan_on', v)}
              />
              <ThresholdSlider
                label="humidity_fan_on"
                hint="fan turns ON below"
                value={thresholds.humidity_fan_on}
                min={20} max={95} step={1} unit="%"
                onChange={(v) => handleThreshold('humidity_fan_on', v)}
              />
              <ThresholdSlider
                label="soil_pump_on"
                hint="pump turns ON below"
                value={thresholds.soil_pump_on}
                min={5} max={60} step={1} unit="%"
                onChange={(v) => handleThreshold('soil_pump_on', v)}
              />
            </div>
          </section>
        )}

        {/* Apply button + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={handleApply}
            disabled={loading}
            style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              padding: '10px 24px', borderRadius: 6,
              border: 'none',
              background: loading ? '#C0D0C0' : (activeMode?.color ?? '#16A34A'),
              color: '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'applying...' : 'apply_config'}
          </button>

          {status && (
            <span style={{
              fontFamily: MONO, fontSize: 11,
              color: status === 'ok' ? '#16A34A' : status === 'warn' ? '#D97706' : '#DC2626',
            }}>
              {status === 'ok' ? '✓' : status === 'warn' ? '⚠' : '✕'} {statusMsg}
            </span>
          )}
        </div>

        {/* Current config summary */}
        {storeControl && (
          <div style={{ marginTop: 32 }}>
            <SectionLabel>// active_config</SectionLabel>
            <div style={{ ...CARD, padding: '16px 20px' }}>
              <pre style={{
                fontFamily: MONO, fontSize: 11, color: '#7A967A',
                margin: 0, lineHeight: 1.8,
              }}>
                {JSON.stringify(storeControl, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
