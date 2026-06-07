import {
  LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Header } from '../components/layout/Header'
import { usePrediction, useScheduledActions } from '../hooks/useGreenhouseData'

const MONO = "'JetBrains Mono',monospace"
const SANS = "'Inter',sans-serif"

const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

const SEVERITY_COLOR = {
  warning: '#D97706',
  info:    '#0891B2',
  ok:      '#16A34A',
}

const SEVERITY_BG = {
  warning: 'rgba(217,119,6,0.06)',
  info:    'rgba(8,145,178,0.06)',
  ok:      'rgba(22,163,74,0.06)',
}

const ACTION_ICON = {
  pre_cool:    '❄',
  reduce_fan:  '↓',
  defer_pump:  '⏸',
  normal_auto: '✓',
  stable:      '✓',
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

function OutsideMetric({ label, value, unit, color }) {
  return (
    <div style={{ ...CARD, padding: '18px 22px' }}>
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: '#9BB09B', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color, margin: '0 0 2px', lineHeight: 1 }}>
        {value != null ? value : '—'}
        {value != null && (
          <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4, color: '#9BB09B' }}>{unit}</span>
        )}
      </p>
      <p style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', margin: 0 }}>outside · current</p>
    </div>
  )
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 8, padding: '10px 14px',
      fontFamily: MONO, fontSize: 11,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <p style={{ color: '#9BB09B', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600, margin: '2px 0' }}>
          {p.name}: {p.value} {p.dataKey === 'temp' ? '°C' : '%'}
        </p>
      ))}
    </div>
  )
}

function RecommendationCard({ rec }) {
  const color = SEVERITY_COLOR[rec.severity] ?? '#9BB09B'
  const bg    = SEVERITY_BG[rec.severity]    ?? 'transparent'
  const icon  = ACTION_ICON[rec.action]      ?? '→'
  const timeLabel = rec.time_offset_min > 0
    ? `in ${rec.time_offset_min} min`
    : 'now'

  return (
    <div style={{
      ...CARD,
      padding: '16px 20px',
      borderLeft: `3px solid ${color}`,
      background: bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18, lineHeight: 1.2 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color, letterSpacing: '0.10em', textTransform: 'uppercase',
            }}>
              {rec.action.replace(/_/g, ' ')}
            </span>
            {rec.device && (
              <span style={{
                fontFamily: MONO, fontSize: 9, color: '#9BB09B',
                background: '#F5F6F8', padding: '2px 8px', borderRadius: 4,
              }}>
                device: {rec.device}
              </span>
            )}
            <span style={{
              fontFamily: MONO, fontSize: 9, color, opacity: 0.7, marginLeft: 'auto',
            }}>
              {timeLabel}
            </span>
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12, color: '#4A664A', margin: 0, lineHeight: 1.5 }}>
            {rec.reason}
          </p>
        </div>
      </div>
    </div>
  )
}

const ACTION_DEVICE_COLOR = { fan: '#D97706', pump: '#0891B2' }

export function PredictionPage() {
  const prediction      = usePrediction()
  const scheduledActions = useScheduledActions()

  const outside = prediction?.current_outside
  const preds   = prediction?.predictions ?? []
  const recs    = prediction?.recommendations ?? []

  // Build chart data — show "now" point + 8 forecast steps
  const chartData = [
    outside
      ? { label: 'now', temp: outside.temp, humidity: outside.humidity, isCurrent: true }
      : null,
    ...preds.map((p) => ({
      label:    `+${p.time_offset_min}m`,
      temp:     p.temp,
      humidity: p.humidity,
      isCurrent: false,
    })),
  ].filter(Boolean)

  // Optimal greenhouse ranges (for reference lines)
  const TEMP_OPT_MAX  = 28   // °C
  const HUM_OPT_MIN   = 70   // %

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="weather_prediction" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        {/* No prediction available */}
        {!prediction && (
          <div style={{
            ...CARD, padding: '28px 32px', marginBottom: 28,
            borderLeft: '3px solid #D97706',
            background: 'rgba(217,119,6,0.04)',
          }}>
            <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#D97706', margin: '0 0 8px', letterSpacing: '0.08em' }}>
              FORECAST_NOT_READY
            </p>
            <p style={{ fontFamily: SANS, fontSize: 13, color: '#6A806A', margin: 0, lineHeight: 1.6 }}>
              The backend is fetching weather data from Open-Meteo on startup.
              Please wait a moment and refresh — no setup required.
            </p>
          </div>
        )}

        {/* Current outside conditions */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// outside_conditions · current</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <OutsideMetric
              label="outside_temp"
              value={outside?.temp}
              unit="°C"
              color={
                !outside ? '#9BB09B'
                : outside.temp > 33 ? '#DC2626'
                : outside.temp > 28 ? '#D97706'
                : '#16A34A'
              }
            />
            <OutsideMetric
              label="outside_humidity"
              value={outside?.humidity}
              unit="%"
              color={
                !outside ? '#9BB09B'
                : outside.humidity > 82 ? '#0891B2'
                : outside.humidity < 50 ? '#D97706'
                : '#16A34A'
              }
            />
            {outside?.timestamp && (
              <div style={{ ...CARD, padding: '18px 22px' }}>
                <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: '#9BB09B', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  last_fetch
                </p>
                <p style={{ fontFamily: MONO, fontSize: 12, color: '#1A261A', margin: 0, lineHeight: 1.6 }}>
                  {outside.timestamp.replace('_30m', ' (+30m)')}
                </p>
                <p style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', margin: '4px 0 0' }}>
                  updates every 30 min
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Forecast chart */}
        {chartData.length > 1 && (
          <section style={{ marginBottom: 28 }}>
            <SectionLabel>// forecast · next {prediction?.horizon_hours}h · {preds.length} steps × {prediction?.step_minutes}min</SectionLabel>
            <div style={{ ...CARD, padding: '20px 24px 12px' }}>

              {/* Temperature */}
              <p style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                temperature (°C)
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="label"
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip content={<ForecastTooltip />} />
                  <ReferenceLine y={TEMP_OPT_MAX} stroke="#D97706" strokeDasharray="4 4"
                    label={{ value: 'opt.max', fill: '#D97706', fontSize: 8, fontFamily: MONO }} />
                  <Line
                    type="monotone" dataKey="temp" name="temp"
                    stroke="#DC2626" strokeWidth={2} dot={{ r: 3, fill: '#DC2626' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Humidity */}
              <p style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '16px 0 6px' }}>
                humidity (%)
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="label"
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip content={<ForecastTooltip />} />
                  <ReferenceLine y={82} stroke="#0891B2" strokeDasharray="4 4"
                    label={{ value: 'rain risk', fill: '#0891B2', fontSize: 8, fontFamily: MONO }} />
                  <ReferenceLine y={HUM_OPT_MIN} stroke="#16A34A" strokeDasharray="4 4"
                    label={{ value: 'greenhouse min', fill: '#16A34A', fontSize: 8, fontFamily: MONO }} />
                  <Line
                    type="monotone" dataKey="humidity" name="humidity"
                    stroke="#0891B2" strokeWidth={2} dot={{ r: 3, fill: '#0891B2' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

            </div>
          </section>
        )}

        {/* Proactive recommendations */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// proactive_recommendations · {recs.length} action{recs.length !== 1 ? 's' : ''}</SectionLabel>
          {recs.length === 0 && !prediction && (
            <div style={{ ...CARD, padding: '20px 24px', color: '#C0D0C0', fontFamily: MONO, fontSize: 11 }}>
              awaiting_forecast...
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((rec, i) => (
              <RecommendationCard key={i} rec={rec} />
            ))}
          </div>
        </section>

        {/* Raw forecast table */}
        {preds.length > 0 && (
          <section>
            <SectionLabel>// forecast_table · source: open-meteo</SectionLabel>
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #EAEDEA' }}>
                    {['time_offset', 'temp (°C)', 'humidity (%)', 'rain %', 'status'].map((h, i) => (
                      <th key={h} style={{
                        padding: '8px 16px', fontFamily: MONO, fontSize: 9, fontWeight: 600,
                        color: '#9BB09B', letterSpacing: '0.08em', textTransform: 'uppercase',
                        textAlign: i === 0 ? 'left' : 'right',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preds.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F2F4F2', background: p.precipitation_probability >= 40 ? 'rgba(8,145,178,0.03)' : 'transparent' }}>
                      <td style={{ padding: '7px 16px', fontFamily: MONO, fontSize: 11, color: '#9BB09B' }}>
                        +{p.time_offset_min} min
                      </td>
                      <td style={{
                        padding: '7px 16px', fontFamily: MONO, fontSize: 11, textAlign: 'right',
                        color: p.temp > 33 ? '#DC2626' : p.temp > 28 ? '#D97706' : '#16A34A',
                        fontWeight: 600,
                      }}>
                        {p.temp}
                      </td>
                      <td style={{
                        padding: '7px 16px', fontFamily: MONO, fontSize: 11, textAlign: 'right',
                        color: p.humidity > 82 ? '#0891B2' : '#1A261A',
                      }}>
                        {p.humidity}
                      </td>
                      <td style={{
                        padding: '7px 16px', fontFamily: MONO, fontSize: 11, textAlign: 'right',
                        color: p.precipitation_probability > 40 ? '#0891B2' : '#9BB09B',
                        fontWeight: p.precipitation_probability > 40 ? 600 : 400,
                      }}>
                        {p.precipitation_probability ?? '—'}
                      </td>
                      <td style={{ padding: '7px 16px', textAlign: 'right' }}>
                        {p.precipitation_probability >= 40
                          ? <span style={{ fontFamily: MONO, fontSize: 9, color: '#0891B2', background: 'rgba(8,145,178,0.1)', padding: '2px 8px', borderRadius: 4 }}>rain</span>
                          : <span style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B' }}>clear</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Proactive action log */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// auto_commands_sent · proactive scheduler</SectionLabel>
          {scheduledActions.length === 0 ? (
            <div style={{ ...CARD, padding: '18px 24px' }}>
              <p style={{ fontFamily: MONO, fontSize: 11, color: '#C0D0C0', margin: 0 }}>
                no_commands_sent · waiting for forecast trigger
              </p>
            </div>
          ) : (
            <div style={{ ...CARD, overflow: 'hidden' }}>
              {scheduledActions.map((a, i) => {
                const devColor = ACTION_DEVICE_COLOR[a.device] ?? '#9BB09B'
                const sentTime = new Date(a.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                return (
                  <div key={i} style={{
                    padding: '14px 20px',
                    borderBottom: i < scheduledActions.length - 1 ? '1px solid #F2F4F2' : 'none',
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                  }}>
                    {/* Device badge */}
                    <div style={{
                      background: devColor + '18',
                      border: `1px solid ${devColor}40`,
                      borderRadius: 6, padding: '4px 10px',
                      fontFamily: MONO, fontSize: 10, fontWeight: 700,
                      color: devColor, letterSpacing: '0.08em',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {a.device ?? '—'} {a.action === 'pump_on' || a.action === 'fan_on' ? 'ON' : 'OFF'}
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: SANS, fontSize: 12, color: '#1A261A', margin: '0 0 4px', lineHeight: 1.5 }}>
                        {a.reason}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B' }}>
                          sent: {sentTime}
                        </span>
                        {a.duration_s > 0 && (
                          <span style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B' }}>
                            auto_off: {a.auto_off}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
