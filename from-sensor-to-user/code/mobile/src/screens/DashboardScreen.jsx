import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MetricCard } from '../components/MetricCard'
import { StageBadge } from '../components/StageBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { useGreenhouseSnapshot } from '../hooks/useSocket'

export function DashboardScreen() {
  const { environment: env, devices, ai, lastUpdated } = useGreenhouseSnapshot()

  const tempColor = !env ? '#1A261A'
    : env.air_temperature > 30 ? '#DC2626'
    : env.air_temperature < 22 ? '#0891B2'
    : '#16A34A'

  const humColor = !env ? '#1A261A'
    : env.air_humidity < 70 ? '#D97706'
    : env.air_humidity > 93 ? '#0891B2'
    : '#16A34A'

  const soilColor = !env ? '#1A261A'
    : env.soil_moisture < 40 ? '#D97706'
    : env.soil_moisture > 85 ? '#0891B2'
    : '#16A34A'

  const ts = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>dashboard</Text>
        <ConnectionBadge />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.statusBar}>
          <Text style={styles.statusLabel}>rack-1 / environment</Text>
          <Text style={[styles.statusTs, { color: ts ? '#16A34A' : '#C0D0C0' }]}>
            {ts ? `updated ${ts}` : 'awaiting data...'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>// environment</Text>
        <View style={styles.row}>
          <MetricCard label="air_temp" value={env?.air_temperature?.toFixed(1)} unit="°C" color={tempColor}
            note={env?.air_temperature > 30 ? '⚠ above threshold' : env?.air_temperature < 22 ? '↓ below optimal' : '✓ optimal'} />
          <View style={styles.gap} />
          <MetricCard label="air_hum" value={env?.air_humidity?.toFixed(1)} unit="%" color={humColor}
            note={env?.air_humidity < 70 ? '⚠ too dry' : env?.air_humidity > 93 ? '⚠ too humid' : '✓ optimal'} />
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <MetricCard label="soil" value={env?.soil_moisture?.toFixed(1)} unit="%" color={soilColor}
            note={env?.soil_moisture < 40 ? '⚠ too dry' : env?.soil_moisture > 85 ? '⚠ too wet' : '✓ optimal'} />
          <View style={styles.gap} />
          <View style={{ flex: 1 }} />
        </View>

        <Text style={styles.sectionLabel}>// devices</Text>
        <View style={styles.row}>
          <MetricCard label="cooling fan" value={devices ? (devices.fan ? 'ON' : 'OFF') : null}
            color={devices?.fan ? '#D97706' : '#9BB09B'} note={devices?.fan ? 'relay: active' : 'relay: idle'} />
          <View style={styles.gap} />
          <MetricCard label="water pump" value={devices ? (devices.pump ? 'ON' : 'OFF') : null}
            color={devices?.pump ? '#0891B2' : '#9BB09B'} note={devices?.pump ? 'relay: active' : 'relay: idle'} />
        </View>

        <Text style={styles.sectionLabel}>// ai_classification</Text>
        <View style={styles.aiCard}>
          <Text style={styles.aiSubLabel}>health_status</Text>
          <StageBadge status={ai?.status} />
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
  statusBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statusLabel:  { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  statusTs:     { fontFamily: 'monospace', fontSize: 10 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#9BB09B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  row:          { flexDirection: 'row', marginBottom: 4 },
  gap:          { width: 10 },
  aiCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  aiRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 32, marginBottom: 14 },
  aiSubLabel:   { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  aiConfValue:  { fontFamily: 'monospace', fontSize: 28, fontWeight: '700', color: '#1A261A' },
  aiConfUnit:   { fontSize: 14, color: '#C0D0C0', fontWeight: '400' },
  progressBg:   { height: 5, backgroundColor: '#EAEDEA', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
})
