import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Header } from '../components/layout/Header'
import { useEnvironment } from '../hooks/useGreenhouseData'

const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <p style={{ color: '#9BB09B', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{Number(p.value).toFixed(1)}</strong>
        </p>
      ))}
    </div>
  )
}

function ChartPanel({ title, dataKey, data, color, unit, domain }) {
  return (
    <div style={{ ...CARD, padding: '20px 24px' }}>
      <p style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 10, fontWeight: 600,
        color: '#9BB09B', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 16,
      }}>
        // {title}
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis dataKey="time"
            tick={{ fill: '#B8C8B8', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={domain}
            tick={{ fill: '#B8C8B8', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}
            tickLine={false} axisLine={false} tickFormatter={(v) => `${v}${unit}`} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey={dataKey} name={title}
            stroke={color} strokeWidth={2}
            fill={`url(#g-${dataKey})`}
            dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function EnvironmentPage() {
  const { data, history } = useEnvironment()

  const chartData = history.slice(-60).map((r) => ({
    time:         new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    air_temperature: r.air_temperature,
    air_humidity:    r.air_humidity,
    soil_moisture:   r.soil_moisture,
  }))

  const tempColor = !data ? '#1A261A'
    : data.air_temperature > 30 ? '#DC2626'
    : data.air_temperature < 22 ? '#0891B2'
    : '#16A34A'

  const humColor = !data ? '#1A261A'
    : data.air_humidity < 70 ? '#D97706'
    : '#0891B2'

  const soilColor = !data ? '#1A261A'
    : data.soil_moisture < 40 ? '#D97706'
    : data.soil_moisture > 85 ? '#0891B2'
    : '#16A34A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="environment" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        {/* current readings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'air_temperature', value: data?.air_temperature?.toFixed(1), unit: '°C', color: tempColor },
            { label: 'air_humidity',    value: data?.air_humidity?.toFixed(1),    unit: '%',  color: humColor  },
            { label: 'soil_moisture',   value: data?.soil_moisture?.toFixed(1),   unit: '%',  color: soilColor },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ ...CARD, padding: '18px 24px' }}>
              <p style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10, fontWeight: 600,
                color: '#9BB09B', letterSpacing: '0.12em',
                textTransform: 'uppercase', margin: '0 0 8px',
              }}>
                {label}
              </p>
              <p style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 36, fontWeight: 700,
                color, margin: 0, lineHeight: 1,
                letterSpacing: '-0.02em', transition: 'color 0.4s',
              }}>
                {value ?? '—'}
                <span style={{ fontSize: 17, color: '#C0D0C0', marginLeft: 6, fontWeight: 400 }}>{unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* charts */}
        {chartData.length === 0 ? (
          <div style={{
            ...CARD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 180, color: '#C0D0C0', fontSize: 12,
            fontFamily: "'JetBrains Mono',monospace",
          }}>
            awaiting_data...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ChartPanel title="air_temperature" dataKey="air_temperature" data={chartData}
              color="#DC2626" unit="°" domain={[15, 40]} />
            <ChartPanel title="air_humidity" dataKey="air_humidity" data={chartData}
              color="#0891B2" unit="%" domain={[40, 100]} />
            <ChartPanel title="soil_moisture" dataKey="soil_moisture" data={chartData}
              color="#16A34A" unit="%" domain={[0, 100]} />
          </div>
        )}

        {/* history table */}
        <div style={{ marginTop: 20 }}>
          <p style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10, fontWeight: 600,
            color: '#9BB09B', letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 10px',
            paddingBottom: 8, borderBottom: '1px solid #EAEDEA',
          }}>
            // history · {history.length} records
          </p>
          <div style={{
            ...CARD,
            overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#FAFBFC', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid #EAEDEA' }}>
                  {['timestamp', 'temp (°C)', 'humidity (%)', 'soil (%)'].map((h, i) => (
                    <th key={h} style={{
                      padding: '8px 16px',
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 10, fontWeight: 600,
                      color: '#9BB09B', letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      textAlign: i === 0 ? 'left' : 'right',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().slice(0, 100).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F2F4F2' }}>
                    <td style={{
                      padding: '7px 16px', fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 11, color: '#9BB09B',
                    }}>
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '7px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#1A261A', textAlign: 'right' }}>
                      {r.air_temperature?.toFixed(1)}
                    </td>
                    <td style={{ padding: '7px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#1A261A', textAlign: 'right' }}>
                      {r.air_humidity?.toFixed(1)}
                    </td>
                    <td style={{ padding: '7px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#1A261A', textAlign: 'right' }}>
                      {r.soil_moisture?.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: '#C0D0C0', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                      no_data_yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
