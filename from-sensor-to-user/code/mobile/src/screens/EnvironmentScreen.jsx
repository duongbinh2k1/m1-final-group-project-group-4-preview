import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { VictoryArea, VictoryAxis, VictoryChart, VictoryTheme } from 'victory-native'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { useEnvironment } from '../hooks/useSocket'

const SCREEN_W   = Dimensions.get('window').width
const CARD_PAD   = 16 * 2          // readingCard horizontal padding
const SCREEN_PAD = 16 * 2          // scroll content padding
const CHART_H    = 110
// Each data point = 6px → 60 points = 360px, clamp to at least screen width
const PX_PER_PT  = 6

function MiniChart({ data, dataKey, color, domain }) {
  if (!data.length) return null
  const chartData  = data.map((r, i) => ({ x: i, y: r[dataKey] ?? 0 }))
  const chartWidth = Math.max(
    SCREEN_W - SCREEN_PAD - CARD_PAD,
    chartData.length * PX_PER_PT
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // start at the right end so user sees latest data
      onContentSizeChange={(w) => {}}
      ref={(ref) => ref?.scrollToEnd({ animated: false })}
    >
      <VictoryChart
        theme={VictoryTheme.clean}
        width={chartWidth}
        height={CHART_H}
        padding={{ top: 8, bottom: 24, left: 32, right: 12 }}
        domain={{ x: [0, Math.max(chartData.length - 1, 1)], y: domain }}
      >
        <VictoryAxis
          style={{ axis: { stroke: '#EAEDEA' }, tickLabels: { fontSize: 8, fill: '#B8C8B8', fontFamily: 'monospace' } }}
          tickCount={Math.min(6, chartData.length)}
          tickFormat={(t) => {
            const r = data[Math.round(t)]
            return r ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
          }}
        />
        <VictoryAxis dependentAxis
          style={{ axis: { stroke: 'transparent' }, tickLabels: { fontSize: 8, fill: '#B8C8B8', fontFamily: 'monospace' }, grid: { stroke: 'rgba(0,0,0,0.05)', strokeDasharray: '4 4' } }}
          tickCount={4}
        />
        <VictoryArea data={chartData}
          style={{ data: { stroke: color, strokeWidth: 2, fill: color, fillOpacity: 0.12 } }}
          interpolation="monotoneX" animate={false}
        />
      </VictoryChart>
    </ScrollView>
  )
}

function ReadingCard({ label, value, unit, color, children }) {
  return (
    <View style={styles.readingCard}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>
        {value ?? '—'}
        {value != null && <Text style={styles.cardUnit}> {unit}</Text>}
      </Text>
      {children}
    </View>
  )
}

export function EnvironmentScreen() {
  const { data, history } = useEnvironment()
  const chartData = history.slice(-60)

  const tempColor  = !data ? '#1A261A' : data.air_temperature > 30 ? '#DC2626' : data.air_temperature < 22 ? '#0891B2' : '#16A34A'
  const humColor   = !data ? '#1A261A' : data.air_humidity < 70 ? '#D97706' : '#16A34A'
  const soilColor  = !data ? '#1A261A' : data.soil_moisture < 40 ? '#D97706' : data.soil_moisture > 85 ? '#0891B2' : '#16A34A'

  const recentHistory = [...history].reverse().slice(0, 50)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>environment</Text>
        <ConnectionBadge />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.sectionLabel}>// current_readings</Text>
        <ReadingCard label="air_temperature" value={data?.air_temperature?.toFixed(1)} unit="°C" color={tempColor}>
          <MiniChart data={chartData} dataKey="air_temperature" color="#DC2626" domain={[15, 40]} />
        </ReadingCard>
        <View style={{ height: 12 }} />
        <ReadingCard label="air_humidity" value={data?.air_humidity?.toFixed(1)} unit="%" color={humColor}>
          <MiniChart data={chartData} dataKey="air_humidity" color="#0891B2" domain={[40, 100]} />
        </ReadingCard>
        <View style={{ height: 12 }} />
        <ReadingCard label="soil_moisture" value={data?.soil_moisture?.toFixed(1)} unit="%" color={soilColor}>
          <MiniChart data={chartData} dataKey="soil_moisture" color="#16A34A" domain={[0, 100]} />
        </ReadingCard>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>// history · {history.length} records</Text>
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            {['time', 'temp', 'hum', 'soil'].map((h, i) => (
              <Text key={h} style={[styles.th, i > 0 && styles.thRight]}>{h}</Text>
            ))}
          </View>
          {recentHistory.length === 0 ? (
            <Text style={styles.empty}>no_data_yet</Text>
          ) : recentHistory.map((r, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={styles.tdTime}>{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
              <Text style={styles.tdVal}>{r.air_temperature?.toFixed(1)}</Text>
              <Text style={styles.tdVal}>{r.air_humidity?.toFixed(1)}</Text>
              <Text style={styles.tdVal}>{r.soil_moisture?.toFixed(1)}</Text>
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
  readingCard:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardLabel:    { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
  cardValue:    { fontFamily: 'monospace', fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  cardUnit:     { fontSize: 15, color: '#C0D0C0', fontWeight: '400' },
  tableCard:    { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EAEDEA', backgroundColor: '#FAFBFC', paddingVertical: 8, paddingHorizontal: 12 },
  th:           { flex: 2, fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1, textTransform: 'uppercase' },
  thRight:      { flex: 1, textAlign: 'right' },
  tableRow:     { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 12 },
  tableRowAlt:  { backgroundColor: '#FAFBFC' },
  tdTime:       { flex: 2, fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  tdVal:        { flex: 1, fontFamily: 'monospace', fontSize: 10, color: '#1A261A', textAlign: 'right' },
  empty:        { fontFamily: 'monospace', fontSize: 11, color: '#C0D0C0', textAlign: 'center', padding: 24 },
})
