import { View, Text, StyleSheet } from 'react-native'

const HEALTH_CONFIG = {
  healthy:  { color: '#16A34A', bg: 'rgba(22,163,74,0.12)'  },
  warning:  { color: '#D97706', bg: 'rgba(217,119,6,0.12)'  },
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)'  },
}

/** HealthBadge — accepts status: 'healthy' | 'warning' | 'critical' */
export function StageBadge({ stage, status }) {
  const s = status ?? stage  // accept both prop names during migration
  if (!s) return <Text style={styles.empty}>—</Text>
  const cfg = HEALTH_CONFIG[s] ?? { color: '#7A967A', bg: 'rgba(122,150,122,0.10)' }
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
      <Text style={[styles.label, { color: cfg.color }]}>{s.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'monospace', fontSize: 13, color: '#A8C4A8' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1, alignSelf: 'flex-start' },
  label: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
})
