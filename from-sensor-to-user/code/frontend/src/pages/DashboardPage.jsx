import { Header } from '../components/layout/Header'
import { MetricCard } from '../components/ui/MetricCard'
import { HealthBadge } from '../components/ui/StageBadge'
import { useGreenhouseSnapshot } from '../hooks/useGreenhouseData'

const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10, fontWeight: 600,
      color: '#9BB09B',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      margin: '0 0 12px',
      paddingBottom: 8,
      borderBottom: '1px solid #EAEDEA',
    }}>
      {children}
    </p>
  )
}

export function DashboardPage() {
  const { environment, devices, ai, lastUpdated } = useGreenhouseSnapshot()

  const tempColor = !environment ? '#1A261A'
    : environment.air_temperature > 30 ? '#DC2626'
    : environment.air_temperature < 22 ? '#0891B2'
    : '#16A34A'

  const humColor = !environment ? '#1A261A'
    : environment.air_humidity < 70  ? '#D97706'
    : environment.air_humidity > 93  ? '#0891B2'
    : '#16A34A'

  const soilColor = !environment ? '#1A261A'
    : environment.soil_moisture < 40 ? '#D97706'
    : environment.soil_moisture > 85 ? '#0891B2'
    : '#16A34A'

  const ts = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="dashboard" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        {/* status bar */}
        <div style={{
          ...CARD,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28,
          padding: '10px 16px',
          fontSize: 11,
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          <span style={{ color: '#9BB09B' }}>rack-1 / environment</span>
          <span style={{ color: ts ? '#16A34A' : '#C0D0C0' }}>
            {ts ? `last_update: ${ts}` : 'awaiting data...'}
          </span>
        </div>

        {/* environment */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// environment</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <MetricCard
              label="air_temperature"
              value={environment?.air_temperature?.toFixed(1)}
              unit="°C"
              color={tempColor}
              accent={environment?.air_temperature > 30}
              note={environment?.air_temperature > 30 ? '⚠ above threshold' : environment?.air_temperature < 22 ? '↓ below optimal' : '✓ optimal range'}
            />
            <MetricCard
              label="air_humidity"
              value={environment?.air_humidity?.toFixed(1)}
              unit="%"
              color={humColor}
              note={environment?.air_humidity < 70 ? '⚠ too dry' : environment?.air_humidity > 93 ? '⚠ too humid' : '✓ optimal range'}
            />
            <MetricCard
              label="soil_moisture"
              value={environment?.soil_moisture?.toFixed(1)}
              unit="%"
              color={soilColor}
              note={environment?.soil_moisture < 40 ? '⚠ too dry' : environment?.soil_moisture > 85 ? '⚠ too wet' : '✓ optimal range'}
            />
          </div>
        </section>

        {/* devices */}
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>// devices</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <MetricCard
              label="cooling fan"
              value={devices ? (devices.fan ? 'ON' : 'OFF') : null}
              color={devices?.fan ? '#D97706' : '#9BB09B'}
              accent={devices?.fan}
              note={devices?.fan ? 'relay: active' : 'relay: idle'}
            />
            <MetricCard
              label="water pump"
              value={devices ? (devices.pump ? 'ON' : 'OFF') : null}
              color={devices?.pump ? '#0891B2' : '#9BB09B'}
              accent={devices?.pump}
              note={devices?.pump ? 'relay: active' : 'relay: idle'}
            />
          </div>
        </section>

        {/* ai */}
        <section>
          <SectionLabel>// ai_classification</SectionLabel>
          <div style={{ ...CARD, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div>
                <p style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10, fontWeight: 600,
                  color: '#9BB09B', letterSpacing: '0.12em',
                  textTransform: 'uppercase', margin: '0 0 8px',
                }}>
                  health_status
                </p>
                <HealthBadge status={ai?.status} />
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
