const HEALTH_CONFIG = {
  healthy:  { color: '#16A34A', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.22)'   },
  warning:  { color: '#D97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.22)'   },
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.22)'   },
}

export function HealthBadge({ status }) {
  if (!status) return (
    <span style={{
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11, color: '#A8C4A8',
    }}>—</span>
  )
  const cfg = HEALTH_CONFIG[status] ?? { color: '#7A967A', bg: 'rgba(122,150,122,0.08)', border: 'rgba(122,150,122,0.2)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 4,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}
