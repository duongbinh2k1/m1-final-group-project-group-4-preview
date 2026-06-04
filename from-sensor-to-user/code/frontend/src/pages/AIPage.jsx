import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Header } from '../components/layout/Header'
import { HealthBadge } from '../components/ui/StageBadge'
import { useAI } from '../hooks/useGreenhouseData'

const MONO = "'JetBrains Mono',monospace"

const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

const STATUS_COLOR = { healthy: '#16A34A', warning: '#D97706', critical: '#DC2626' }
const STATUS_Y     = { healthy: 1, warning: 2, critical: 3 }
const STATUS_LABEL = { 1: 'healthy', 2: 'warning', 3: 'critical' }
const STATUS_BG    = {
  healthy:  'rgba(22,163,74,0.08)',
  warning:  'rgba(217,119,6,0.08)',
  critical: 'rgba(220,38,38,0.08)',
}

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { status, time } = payload[0].payload
  const cfg = STATUS_COLOR[status]
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 8, padding: '10px 14px',
      fontFamily: MONO, fontSize: 11,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      border: `1px solid ${cfg}30`,
    }}>
      <p style={{ color: '#9BB09B', margin: '0 0 4px' }}>{time}</p>
      <p style={{ color: cfg, fontWeight: 700, margin: 0, letterSpacing: '0.08em' }}>
        {status}
      </p>
    </div>
  )
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

// Tally consecutive runs of same status
function computeRuns(history) {
  if (!history.length) return []
  const runs = []
  let cur = { status: history[0].status, count: 1, from: history[0].timestamp }
  for (let i = 1; i < history.length; i++) {
    if (history[i].status === cur.status) {
      cur.count++
    } else {
      runs.push(cur)
      cur = { status: history[i].status, count: 1, from: history[i].timestamp }
    }
  }
  runs.push(cur)
  return runs
}

export function AIPage() {
  const { data, history } = useAI()

  const chartData = history.slice(-80).map((r) => ({
    time:   new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value:  STATUS_Y[r.status] ?? 0,
    status: r.status,
  }))

  const runs = computeRuns(history)

  // Counts per status
  const counts = history.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const total = history.length || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="ai_health" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        {/* Current status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {/* Live badge */}
          <div style={{ ...CARD, padding: '20px 24px', gridColumn: '1' }}>
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: '#9BB09B', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              current_status
            </p>
            {data?.status
              ? <HealthBadge status={data.status} />
              : <span style={{ fontFamily: MONO, fontSize: 11, color: '#C0D0C0' }}>—</span>
            }
          </div>

          {/* Distribution bars */}
          {['healthy', 'warning', 'critical'].map((s) => {
            const pct = Math.round(((counts[s] ?? 0) / total) * 100)
            return (
              <div key={s} style={{ ...CARD, padding: '18px 22px', background: STATUS_BG[s] }}>
                <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: STATUS_COLOR[s], letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  {s}
                </p>
                <p style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: STATUS_COLOR[s], margin: '0 0 6px', lineHeight: 1 }}>
                  {pct}%
                </p>
                <div style={{ height: 4, borderRadius: 2, background: '#EAEDEA', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[s], borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <p style={{ fontFamily: MONO, fontSize: 9, color: STATUS_COLOR[s], margin: '4px 0 0', opacity: 0.7 }}>
                  {counts[s] ?? 0} readings
                </p>
              </div>
            )
          })}
        </div>

        {/* Timeline chart */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// status_timeline · last {chartData.length} readings</SectionLabel>
          <div style={{ ...CARD, padding: '20px 24px 12px' }}>
            {chartData.length === 0 ? (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, color: '#C0D0C0' }}>
                awaiting_data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="time"
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 3.5]} ticks={[1, 2, 3]}
                    tickFormatter={(v) => STATUS_LABEL[v] ?? ''}
                    tick={{ fill: '#B8C8B8', fontSize: 9, fontFamily: MONO }}
                    tickLine={false} axisLine={false} width={52}
                  />
                  <Tooltip content={<StatusTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLOR[entry.status] ?? '#C0D0C0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
              {['healthy', 'warning', 'critical'].map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLOR[s], display: 'inline-block' }} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: '#9BB09B', letterSpacing: '0.06em' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Transition runs */}
        {runs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <SectionLabel>// status_transitions · {runs.length} segments</SectionLabel>
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #EAEDEA' }}>
                    {['from', 'status', 'readings'].map((h, i) => (
                      <th key={h} style={{
                        padding: '8px 16px', fontFamily: MONO, fontSize: 10, fontWeight: 600,
                        color: '#9BB09B', letterSpacing: '0.08em', textTransform: 'uppercase',
                        textAlign: i === 2 ? 'right' : 'left',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...runs].reverse().slice(0, 40).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F2F4F2' }}>
                      <td style={{ padding: '7px 16px', fontFamily: MONO, fontSize: 11, color: '#9BB09B' }}>
                        {new Date(r.from).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '7px 16px' }}>
                        <HealthBadge status={r.status} />
                      </td>
                      <td style={{ padding: '7px 16px', fontFamily: MONO, fontSize: 11, color: '#1A261A', textAlign: 'right' }}>
                        {r.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
