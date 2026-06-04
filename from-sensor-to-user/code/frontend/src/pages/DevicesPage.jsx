import { Header } from '../components/layout/Header'
import { useDevices } from '../hooks/useGreenhouseData'

const CARD = {
  background: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
}

function RelayCard({ name, state, activeColorHex, activeColorRgb, description }) {
  const on = state === true
  return (
    <div style={{
      ...CARD,
      padding: '20px 24px',
      transition: 'box-shadow 0.3s',
      boxShadow: on
        ? `0 0 0 2px rgba(${activeColorRgb},0.15), 0 4px 16px rgba(0,0,0,0.07)`
        : '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, fontWeight: 600,
          color: '#9BB09B', letterSpacing: '0.12em',
          textTransform: 'uppercase', margin: 0,
        }}>
          {name}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px',
          borderRadius: 4,
          background: on ? `rgba(${activeColorRgb},0.08)` : '#F5F6F8',
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, fontWeight: 600,
          color: on ? activeColorHex : '#9BB09B',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: on ? activeColorHex : '#C8D4C8',
            boxShadow: on ? `0 0 6px ${activeColorHex}` : 'none',
            transition: 'all 0.3s',
          }} />
          {on ? 'active' : 'idle'}
        </span>
      </div>

      <p style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 28, fontWeight: 700,
        color: on ? activeColorHex : '#D0D8D0',
        margin: '0 0 8px', lineHeight: 1,
        transition: 'color 0.3s',
        letterSpacing: '-0.02em',
      }}>
        {state == null ? '—' : on ? 'ON' : 'OFF'}
      </p>

      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#9BB09B', margin: 0 }}>
        {description}
      </p>
    </div>
  )
}

export function DevicesPage() {
  const { data, history } = useDevices()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Header title="devices" />
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#F5F6F8' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 28 }}>
          <RelayCard
            name="cooling_fan"
            state={data?.fan}
            activeColorHex="#D97706"
            activeColorRgb="217,119,6"
            description="Triggers when temp > 30°C or humidity < 50%"
          />
          <RelayCard
            name="water_pump"
            state={data?.pump}
            activeColorHex="#0891B2"
            activeColorRgb="8,145,178"
            description="Triggers when soil moisture < 25% (dry soil)"
          />
        </div>

        <p style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, fontWeight: 600,
          color: '#9BB09B', letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: '0 0 10px',
          paddingBottom: 8, borderBottom: '1px solid #EAEDEA',
        }}>
          // state_changes · {history.length} records
        </p>

        <div style={{ ...CARD, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EAEDEA', background: '#FAFBFC' }}>
                {['timestamp', 'fan', 'pump'].map((h, i) => (
                  <th key={h} style={{
                    padding: '8px 16px',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10, fontWeight: 600,
                    color: '#9BB09B', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    textAlign: i === 0 ? 'left' : 'center',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().slice(0, 50).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F2F4F2' }}>
                  <td style={{
                    padding: '7px 16px',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11, color: '#9BB09B',
                  }}>
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '7px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 10, fontWeight: 600,
                      color: r.fan ? '#D97706' : '#D0D8D0',
                      letterSpacing: '0.08em',
                    }}>
                      {r.fan ? '● ON' : '○ off'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 10, fontWeight: 600,
                      color: r.pump ? '#0891B2' : '#D0D8D0',
                      letterSpacing: '0.08em',
                    }}>
                      {r.pump ? '● ON' : '○ off'}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} style={{
                    padding: '24px 16px', textAlign: 'center',
                    color: '#C0D0C0',
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                  }}>
                    no_data_yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
