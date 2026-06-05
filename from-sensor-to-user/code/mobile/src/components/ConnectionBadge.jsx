import { View, Text, StyleSheet } from 'react-native'
import { useConnectionStatus } from '../hooks/useSocket'

const STATUS_COLOR = {
  connected:    '#16A34A',
  connecting:   '#D97706',
  disconnected: '#9BB09B',
  error:        '#DC2626',
}

export function ConnectionBadge() {
  const { status, mqttStatus } = useConnectionStatus()
  const color = STATUS_COLOR[status] ?? '#9BB09B'
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
      <Text style={[styles.text, { color }]}>{status}</Text>
      {mqttStatus === 'connected' && <Text style={styles.mqtt}> · mqtt ✓</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:  { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  text: { fontFamily: 'monospace', fontSize: 10, fontWeight: '600' },
  mqtt: { fontFamily: 'monospace', fontSize: 10, color: '#16A34A' },
})
