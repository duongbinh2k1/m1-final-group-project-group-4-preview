import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { usePrediction } from '../hooks/useSocket'

const SEVERITY_COLOR = {
  warning: '#D97706',
  info:    '#0891B2',
  ok:      '#16A34A',
}

const ACTION_ICON = {
  pre_cool:    '❄',
  reduce_fan:  '↓',
  defer_pump:  '⏸',
  normal_auto: '✓',
  stable:      '✓',
}

function OutsideMetricCard({ label, value, unit, color }) {
  return (
    <View style={[styles.metricCard, { flex: 1 }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {value != null ? `${value}${unit}` : '—'}
      </Text>
      <Text style={styles.metricNote}>outside · now</Text>
    </View>
  )
}

function ForecastRow({ step, isLast }) {
  const tempColor = step.temp > 33 ? '#DC2626' : step.temp > 28 ? '#D97706' : '#16A34A'
  const humColor  = step.humidity > 82 ? '#0891B2' : '#1A261A'
  return (
    <View style={[styles.tableRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.tdOffset}>+{step.time_offset_min}min</Text>
      <Text style={[styles.tdValue, { color: tempColor }]}>{step.temp}°C</Text>
      <Text style={[styles.tdValue, { color: humColor }]}>{step.humidity}%</Text>
    </View>
  )
}

function RecommendationCard({ rec }) {
  const color = SEVERITY_COLOR[rec.severity] ?? '#9BB09B'
  const icon  = ACTION_ICON[rec.action] ?? '→'
  const timeLabel = rec.time_offset_min > 0 ? `in ${rec.time_offset_min} min` : 'now'

  return (
    <View style={[styles.recCard, { borderLeftColor: color }]}>
      <View style={styles.recHeader}>
        <Text style={styles.recIcon}>{icon}</Text>
        <Text style={[styles.recAction, { color }]}>
          {rec.action.replace(/_/g, ' ').toUpperCase()}
        </Text>
        {rec.device && (
          <View style={styles.recDeviceBadge}>
            <Text style={styles.recDeviceText}>{rec.device}</Text>
          </View>
        )}
        <Text style={[styles.recTime, { color }]}>{timeLabel}</Text>
      </View>
      <Text style={styles.recReason}>{rec.reason}</Text>
    </View>
  )
}

// Inline mini sparkline using View bars
function TempBar({ preds }) {
  if (!preds.length) return null
  const temps = preds.map(p => p.temp)
  const minT  = Math.min(...temps)
  const maxT  = Math.max(...temps)
  const range = Math.max(maxT - minT, 1)

  return (
    <View style={styles.sparkWrap}>
      {preds.map((p, i) => {
        const h   = ((p.temp - minT) / range) * 48 + 12
        const col = p.temp > 33 ? '#DC2626' : p.temp > 28 ? '#D97706' : '#16A34A'
        return (
          <View key={i} style={styles.sparkBarWrap}>
            <View style={[styles.sparkBar, { height: h, backgroundColor: col }]} />
            <Text style={styles.sparkLabel}>+{p.time_offset_min}m</Text>
          </View>
        )
      })}
    </View>
  )
}

export function PredictionScreen() {
  const prediction = usePrediction()

  const outside = prediction?.current_outside
  const preds   = prediction?.predictions ?? []
  const recs    = prediction?.recommendations ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>weather_forecast</Text>
        <ConnectionBadge />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* No model warning */}
        {!prediction && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>FORECAST_NOT_READY</Text>
            <Text style={styles.warningBody}>
              The backend is fetching weather data from Open-Meteo on startup.
              Please wait a moment and refresh — no setup required.
            </Text>
          </View>
        )}

        {/* Current outside conditions */}
        <Text style={styles.sectionLabel}>// outside_conditions · current</Text>
        <View style={styles.row}>
          <OutsideMetricCard
            label="outside_temp"
            value={outside?.temp}
            unit="°C"
            color={
              !outside ? '#9BB09B'
              : outside.temp > 33 ? '#DC2626'
              : outside.temp > 28 ? '#D97706'
              : '#16A34A'
            }
          />
          <View style={{ width: 8 }} />
          <OutsideMetricCard
            label="outside_humidity"
            value={outside?.humidity}
            unit="%"
            color={
              !outside ? '#9BB09B'
              : outside.humidity > 82 ? '#0891B2'
              : outside.humidity < 50 ? '#D97706'
              : '#16A34A'
            }
          />
        </View>

        {/* Mini sparkline */}
        {preds.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>// temperature_trend · next {prediction?.horizon_hours}h</Text>
            <View style={styles.card}>
              <TempBar preds={preds} />
            </View>
          </>
        )}

        {/* Proactive recommendations */}
        <Text style={styles.sectionLabel}>// proactive_recommendations · {recs.length} action{recs.length !== 1 ? 's' : ''}</Text>
        {recs.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {prediction ? 'No actions needed — conditions stable' : 'awaiting_forecast...'}
            </Text>
          </View>
        )}
        {recs.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}

        {/* Forecast table */}
        {preds.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>// forecast_table · {preds.length} steps × {prediction?.step_minutes}min</Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1 }]}>offset</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>temp</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>humidity</Text>
              </View>
              {preds.map((p, i) => (
                <ForecastRow key={i} step={p} isLast={i === preds.length - 1} />
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
  row:           { flexDirection: 'row', marginBottom: 16 },
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  warningCard:   { backgroundColor: 'rgba(217,119,6,0.06)', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#D97706' },
  warningTitle:  { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: '#D97706', marginBottom: 8, letterSpacing: 1 },
  warningBody:   { fontFamily: 'monospace', fontSize: 10, color: '#6A806A', lineHeight: 18 },
  metricCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  metricLabel:   { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  metricValue:   { fontFamily: 'monospace', fontSize: 28, fontWeight: '700', marginBottom: 2, lineHeight: 32 },
  metricNote:    { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B' },
  recCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  recHeader:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  recIcon:       { fontSize: 16 },
  recAction:     { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  recDeviceBadge:{ backgroundColor: '#F5F6F8', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  recDeviceText: { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B' },
  recTime:       { fontFamily: 'monospace', fontSize: 9, opacity: 0.7, marginLeft: 'auto' },
  recReason:     { fontFamily: 'monospace', fontSize: 11, color: '#4A664A', lineHeight: 18 },
  sparkWrap:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 80 },
  sparkBarWrap:  { alignItems: 'center', flex: 1 },
  sparkBar:      { width: 8, borderRadius: 2 },
  sparkLabel:    { fontFamily: 'monospace', fontSize: 7, color: '#B8C8B8', marginTop: 4, textAlign: 'center' },
  tableCard:     { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, marginBottom: 16 },
  tableHeader:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EAEDEA', backgroundColor: '#FAFBFC', paddingVertical: 8, paddingHorizontal: 12 },
  th:            { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1, textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F2F4F2' },
  tdOffset:      { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', flex: 1 },
  tdValue:       { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'right' },
  emptyText:     { fontFamily: 'monospace', fontSize: 11, color: '#C0D0C0', textAlign: 'center' },
})
