import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { useDevices } from '../hooks/useSocket'

function RelayCard({ name, state, activeColor, description }) {
  const on = state === true
  return (
    <View style={[styles.relayCard, on && { borderWidth: 1, borderColor: activeColor + '44' }]}>
      <View style={styles.relayTop}>
        <Text style={styles.relayName}>{name}</Text>
        <View style={[styles.badge, { backgroundColor: on ? activeColor + '18' : '#F5F6F8' }]}>
          <View style={[styles.dot, { backgroundColor: on ? activeColor : '#C8D4C8' }]} />
          <Text style={[styles.badgeText, { color: on ? activeColor : '#9BB09B' }]}>{on ? 'active' : 'idle'}</Text>
        </View>
      </View>
      <Text style={[styles.relayValue, { color: on ? activeColor : '#D0D8D0' }]}>
        {state == null ? '—' : on ? 'ON' : 'OFF'}
      </Text>
      <Text style={styles.relayDesc}>{description}</Text>
    </View>
  )
}

export function DevicesScreen() {
  const { data, history } = useDevices()
  const recentHistory = [...history].reverse().slice(0, 50)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>devices</Text>
        <ConnectionBadge />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.sectionLabel}>// relay_status</Text>
        <RelayCard name="cooling_fan" state={data?.fan} activeColor="#D97706" description="Triggers when temp > 29°C or humidity > 93%" />
        <View style={{ height: 12 }} />
        <RelayCard name="water_pump" state={data?.pump} activeColor="#0891B2" description="Triggers when soil moisture < 25%" />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>// state_changes · {history.length} records</Text>
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>time</Text>
            <Text style={[styles.th, styles.thCenter]}>fan</Text>
            <Text style={[styles.th, styles.thCenter]}>pump</Text>
          </View>
          {recentHistory.length === 0 ? (
            <Text style={styles.empty}>no_data_yet</Text>
          ) : recentHistory.map((r, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tdTime, { flex: 2 }]}>{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
              <Text style={[styles.tdStatus, { color: r.fan ? '#D97706' : '#D0D8D0' }]}>{r.fan ? '● ON' : '○ off'}</Text>
              <Text style={[styles.tdStatus, { color: r.pump ? '#0891B2' : '#D0D8D0' }]}>{r.pump ? '● ON' : '○ off'}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F5F6F8' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  title:        { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#1A261A', letterSpacing: 1 },
  scroll:       { flex: 1 },
  content:      { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#9BB09B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  relayCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  relayTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  relayName:    { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#9BB09B', letterSpacing: 1.5, textTransform: 'uppercase' },
  badge:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  dot:          { width: 5, height: 5, borderRadius: 3 },
  badgeText:    { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  relayValue:   { fontFamily: 'monospace', fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  relayDesc:    { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  tableCard:    { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EAEDEA', backgroundColor: '#FAFBFC', paddingVertical: 8, paddingHorizontal: 12 },
  th:           { flex: 1, fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1, textTransform: 'uppercase' },
  thCenter:     { flex: 1, textAlign: 'center' },
  tableRow:     { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12 },
  tableRowAlt:  { backgroundColor: '#FAFBFC' },
  tdTime:       { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  tdStatus:     { flex: 1, fontFamily: 'monospace', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  empty:        { fontFamily: 'monospace', fontSize: 11, color: '#C0D0C0', textAlign: 'center', padding: 24 },
})
