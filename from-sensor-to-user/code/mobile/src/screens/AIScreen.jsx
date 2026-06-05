import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { StageBadge } from '../components/StageBadge'
import { useAI } from '../hooks/useSocket'

const STATUS_COLOR = { healthy: '#16A34A', warning: '#D97706', critical: '#DC2626' }
const STATUS_BG    = {
  healthy:  'rgba(22,163,74,0.08)',
  warning:  'rgba(217,119,6,0.08)',
  critical: 'rgba(220,38,38,0.08)',
}

function computeRuns(history) {
  if (!history.length) return []
  const runs = []
  let cur = { status: history[0].status, count: 1, from: history[0].timestamp }
  for (let i = 1; i < history.length; i++) {
    if (history[i].status === cur.status) {
      cur.count++
    } else {
      runs.push(cur)
      cur = { status: history[i].status, count: 1, from: history[i].timestamp }
    }
  }
  runs.push(cur)
  return runs
}

// Simple colored timeline using React Native Views
function StatusTimeline({ data }) {
  if (!data.length) return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>awaiting_data...</Text>
    </View>
  )
  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineBar}>
        {data.map((item, i) => (
          <View
            key={i}
            style={[styles.timelineSegment, {
              backgroundColor: STATUS_COLOR[item.status] ?? '#C0D0C0',
              flex: 1,
            }]}
          />
        ))}
      </View>
      <View style={styles.timelineLabels}>
        <Text style={styles.timelineLabelText}>
          {data[0]?.time}
        </Text>
        <Text style={styles.timelineLabelText}>
          {data[data.length - 1]?.time}
        </Text>
      </View>
    </View>
  )
}

export function AIScreen() {
  const { data, history } = useAI()

  const recentHistory = history.slice(-80).map(r => ({
    time:   new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: r.status,
  }))

  const counts = history.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const total = history.length || 1
  const runs  = computeRuns(history)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>ai_health</Text>
        <ConnectionBadge />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Current status */}
        <Text style={styles.sectionLabel}>// current_status</Text>
        <View style={styles.currentCard}>
          <StageBadge status={data?.status} />
        </View>

        {/* Distribution */}
        <Text style={styles.sectionLabel}>// distribution</Text>
        <View style={styles.row}>
          {['healthy', 'warning', 'critical'].map(s => {
            const pct = Math.round(((counts[s] ?? 0) / total) * 100)
            return (
              <View key={s} style={[styles.distCard, { backgroundColor: STATUS_BG[s], flex: 1, marginRight: s !== 'critical' ? 8 : 0 }]}>
                <Text style={[styles.distLabel, { color: STATUS_COLOR[s] }]}>{s}</Text>
                <Text style={[styles.distPct, { color: STATUS_COLOR[s] }]}>{pct}%</Text>
                <View style={styles.distBarBg}>
                  <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: STATUS_COLOR[s] }]} />
                </View>
                <Text style={[styles.distCount, { color: STATUS_COLOR[s] }]}>{counts[s] ?? 0} readings</Text>
              </View>
            )
          })}
        </View>

        {/* Timeline */}
        <Text style={styles.sectionLabel}>// status_timeline · {recentHistory.length} readings</Text>
        <View style={styles.card}>
          <StatusTimeline data={recentHistory} />
          {/* Legend */}
          <View style={styles.legend}>
            {['healthy', 'warning', 'critical'].map(s => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={styles.legendText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transitions table */}
        {runs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>// transitions · {runs.length} segments</Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>from</Text>
                <Text style={[styles.th, { flex: 2 }]}>status</Text>
                <Text style={[styles.th, { textAlign: 'right' }]}>readings</Text>
              </View>
              {[...runs].reverse().slice(0, 30).map((r, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tdTime, { flex: 2 }]}>
                    {new Date(r.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                  <View style={{ flex: 2 }}>
                    <StageBadge status={r.status} />
                  </View>
                  <Text style={styles.tdCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F5F6F8' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  title:         { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#1A261A', letterSpacing: 1 },
  scroll:        { flex: 1 },
  content:       { padding: 16, paddingBottom: 40 },
  sectionLabel:  { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', color: '#9BB09B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  currentCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  row:           { flexDirection: 'row', marginBottom: 16 },
  distCard:      { borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  distLabel:     { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  distPct:       { fontFamily: 'monospace', fontSize: 22, fontWeight: '700', marginBottom: 6, lineHeight: 26 },
  distBarBg:     { height: 4, backgroundColor: '#EAEDEA', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  distBarFill:   { height: '100%', borderRadius: 2 },
  distCount:     { fontFamily: 'monospace', fontSize: 9, opacity: 0.7 },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  timelineWrap:  { marginBottom: 8 },
  timelineBar:   { flexDirection: 'row', height: 28, borderRadius: 4, overflow: 'hidden' },
  timelineSegment: {},
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timelineLabelText: { fontFamily: 'monospace', fontSize: 9, color: '#B8C8B8' },
  legend:        { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 8, height: 8, borderRadius: 2 },
  legendText:    { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B' },
  emptyBox:      { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText:     { fontFamily: 'monospace', fontSize: 11, color: '#C0D0C0' },
  tableCard:     { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tableHeader:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EAEDEA', backgroundColor: '#FAFBFC', paddingVertical: 8, paddingHorizontal: 12 },
  th:            { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1, textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  tableRowAlt:   { backgroundColor: '#FAFBFC' },
  tdTime:        { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  tdCount:       { fontFamily: 'monospace', fontSize: 11, color: '#1A261A', textAlign: 'right' },
})
