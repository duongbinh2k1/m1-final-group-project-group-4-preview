import { View, Text, StyleSheet } from 'react-native'

export function MetricCard({ label, value, unit, color = '#1A261A', note }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>
        {value ?? '—'}
        {value != null && <Text style={styles.unit}> {unit}</Text>}
      </Text>
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, flex: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  label: { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  value: { fontFamily: 'monospace', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  unit:  { fontSize: 14, color: '#C0D0C0', fontWeight: '400' },
  note:  { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', marginTop: 6 },
})
