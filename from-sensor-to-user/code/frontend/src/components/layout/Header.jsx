import { ConnectionBadge } from '../status/ConnectionBadge'

export function Header({ title }) {
  return (
    <header style={{
      height: 54,
      borderBottom: '1px solid #EAEDEA',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: '#FFFFFF',
      flexShrink: 0,
    }}>
      <p style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 13, fontWeight: 600,
        color: '#1A261A', margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </p>
      <ConnectionBadge />
    </header>
  )
}
