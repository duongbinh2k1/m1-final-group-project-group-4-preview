export function MetricCard({ label, value, unit, color, note, accent }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 10,
      padding: '20px 22px',
      boxShadow: accent
        ? '0 0 0 2px rgba(22,163,74,0.15), 0 4px 16px rgba(0,0,0,0.07)'
        : '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.3s',
    }}>
      <p style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 10, fontWeight: 600,
        color: '#9BB09B',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin: '0 0 10px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 32, fontWeight: 700,
        color: color ?? '#1A261A',
        margin: 0, lineHeight: 1,
        letterSpacing: '-0.02em',
        transition: 'color 0.4s',
      }}>
        {value ?? '—'}
        {unit && (
          <span style={{ fontSize: 15, color: '#C0D0C0', marginLeft: 5, fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </p>
      {note && (
        <p style={{
          fontFamily: "'Inter',sans-serif",
          fontSize: 11, color: '#9BB09B', margin: '8px 0 0',
        }}>
          {note}
        </p>
      )}
    </div>
  )
}
