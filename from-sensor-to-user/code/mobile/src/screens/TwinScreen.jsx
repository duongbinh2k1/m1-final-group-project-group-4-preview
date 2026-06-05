import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Slider from '@react-native-community/slider'
import { Scene } from '../components/twin/Scene'
import { StageBadge } from '../components/StageBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { useGreenhouseSnapshot } from '../hooks/useSocket'

const HEALTH_STATUSES = ['healthy', 'warning', 'critical']

const DEFAULT_SIM = {
  air_temperature: 24,
  air_humidity:    80,
  soil_moisture:   60,
  status:          'healthy',
  fan:             false,
  pump:            true,
}

// ─── sim panel ────────────────────────────────────────────────────────────────

function SimSlider({ label, value, min, max, step, unit, onChange }) {
  return (
    <View style={ss.sliderRow}>
      <View style={ss.sliderLabelRow}>
        <Text style={ss.sliderLabel}>{label}</Text>
        <Text style={ss.sliderValue}>{Number(value).toFixed(1)}{unit}</Text>
      </View>
      <Slider
        style={ss.slider}
        minimumValue={min} maximumValue={max} step={step ?? 0.5}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#16A34A"
        maximumTrackTintColor="#EAEDEA"
        thumbTintColor="#16A34A"
      />
    </View>
  )
}

function SimPanel({ sim, onChange }) {
  const [open, setOpen] = useState(true)
  return (
    <View style={ss.panel}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={ss.panelHeader}>
        <Text style={ss.panelTitle}>⚙ sim_mode active</Text>
        <Text style={ss.panelChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView style={ss.panelBody} scrollEnabled keyboardShouldPersistTaps="handled">
          <View style={ss.divider} />
          <SimSlider label="air_temperature" value={sim.air_temperature} min={-20} max={80} unit="°C"
            onChange={(v) => onChange('air_temperature', v)} />
          <SimSlider label="air_humidity" value={sim.air_humidity} min={0} max={100} step={1} unit="%"
            onChange={(v) => onChange('air_humidity', v)} />
          <SimSlider label="soil_moisture" value={sim.soil_moisture} min={0} max={100} step={1} unit="%"
            onChange={(v) => onChange('soil_moisture', v)} />
          <View style={ss.divider} />
          <Text style={ss.subLabel}>health_status</Text>
          <View style={ss.stageRow}>
            {HEALTH_STATUSES.map((s) => (
              <TouchableOpacity key={s} onPress={() => onChange('status', s)}
                style={[ss.stageBtn, sim.status === s && ss.stageBtnActive]}>
                <Text style={[ss.stageBtnText, sim.status === s && ss.stageBtnTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={ss.divider} />
          <View style={ss.toggleRow}>
            {[['fan', '#D97706'], ['pump', '#0891B2']].map(([key, color]) => (
              <TouchableOpacity key={key} onPress={() => onChange(key, !sim[key])}
                style={[ss.toggleBtn, sim[key] && { borderColor: color, backgroundColor: color + '18' }]}>
                <Text style={[ss.toggleBtnText, sim[key] && { color }]}>
                  {key} {sim[key] ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

// ─── data panel ───────────────────────────────────────────────────────────────

function DataRow({ label, value, color }) {
  return (
    <View style={dp.row}>
      <Text style={dp.label}>{label}</Text>
      <Text style={[dp.value, color && { color }]}>{value ?? '—'}</Text>
    </View>
  )
}

function DataPanel({ envData, devData, aiData, simMode }) {
  const temp  = envData?.air_temperature
  const hum   = envData?.air_humidity
  const fanOn  = devData?.fan  === true
  const pumpOn = devData?.pump === true

  const tempColor = temp == null ? '#9BB09B' : temp > 30 ? '#DC2626' : temp < 22 ? '#0891B2' : '#16A34A'
  const humColor  = hum  == null ? '#9BB09B' : hum < 70 ? '#D97706' : hum > 93 ? '#0891B2' : '#16A34A'

  return (
    <View style={dp.card}>
      <Text style={dp.title}>{simMode ? 'sim data' : 'live data'}</Text>
      <DataRow label="air_temp"     value={temp != null ? `${temp.toFixed(1)} °C` : null} color={tempColor} />
      <DataRow label="air_humidity" value={hum  != null ? `${hum.toFixed(1)} %`   : null} color={humColor}  />
      {envData?.soil_moisture != null && (
        <DataRow label="soil"
          value={`${envData.soil_moisture.toFixed(1)} %`}
          color={envData.soil_moisture < 40 ? '#D97706' : envData.soil_moisture > 85 ? '#0891B2' : '#16A34A'}
        />
      )}
      <View style={dp.divider} />
      {[['cooling fan', fanOn, '#D97706'], ['water pump', pumpOn, '#0891B2']].map(([label, on, color]) => (
        <View key={label} style={dp.row}>
          <Text style={dp.label}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[dp.dot, { backgroundColor: on ? color : '#D0D8D0' }]} />
            <Text style={[dp.value, { color: on ? color : '#9BB09B' }]}>
              {devData == null ? '—' : on ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
      ))}
      {aiData?.status && (
        <>
          <View style={dp.divider} />
          <View style={[dp.row, { alignItems: 'center' }]}>
            <Text style={dp.label}>health_status</Text>
            <StageBadge status={aiData.status} />
          </View>
        </>
      )}
    </View>
  )
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function TwinScreen() {
  const { environment, devices, ai } = useGreenhouseSnapshot()
  const [simMode, setSimMode] = useState(false)
  const [sim, setSim] = useState(DEFAULT_SIM)

  function handleSimChange(key, value) {
    setSim((prev) => ({ ...prev, [key]: value }))
  }

  const envData = simMode ? sim                                             : environment
  const devData = simMode ? { fan: sim.fan, pump: sim.pump }  : devices
  const aiData  = simMode ? { status: sim.status }           : ai

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>3d_twin</Text>
        <ConnectionBadge />
      </View>

      <View style={styles.canvas}>
        <Scene environment={envData} devices={devData} ai={aiData} />

        {/* data panel — top right */}
        <View style={styles.dataPanel} pointerEvents="none">
          <DataPanel envData={envData} devData={devData} aiData={aiData} simMode={simMode} />
        </View>

        {/* sim mode toggle — top left */}
        <TouchableOpacity
          style={[styles.simToggle, simMode && styles.simToggleActive]}
          onPress={() => setSimMode(m => !m)}
        >
          <Text style={[styles.simToggleText, simMode && styles.simToggleTextActive]}>
            {simMode ? '● sim_mode' : '○ sim_mode'}
          </Text>
        </TouchableOpacity>

        {/* sim controls — bottom left */}
        {simMode && (
          <View style={styles.simPanel}>
            <SimPanel sim={sim} onChange={handleSimChange} />
          </View>
        )}

        {/* hint — bottom center */}
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>drag to rotate · pinch to zoom</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#EDF2ED' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  title:             { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#1A261A', letterSpacing: 1 },
  canvas:            { flex: 1, position: 'relative' },
  dataPanel:         { position: 'absolute', top: 12, right: 12 },
  simToggle:         { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#DDEADD', backgroundColor: 'rgba(255,255,255,0.85)' },
  simToggleActive:   { borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.10)' },
  simToggleText:     { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1.5, textTransform: 'uppercase' },
  simToggleTextActive:{ color: '#D97706' },
  simPanel:          { position: 'absolute', bottom: 16, left: 12, maxWidth: 220 },
  hint:              { position: 'absolute', bottom: 16, alignSelf: 'center', left: '50%', transform: [{ translateX: -80 }], backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  hintText:          { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', letterSpacing: 0.5 },
})

// sim panel styles
const ss = StyleSheet.create({
  panel:            { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  panelHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  panelTitle:       { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#D97706', letterSpacing: 1.5, textTransform: 'uppercase' },
  panelChevron:     { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B' },
  panelBody:        { paddingHorizontal: 14, paddingBottom: 14, maxHeight: 280 },
  divider:          { height: 1, backgroundColor: '#EAEDEA', marginVertical: 10 },
  sliderRow:        { marginBottom: 6 },
  sliderLabelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  sliderLabel:      { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', letterSpacing: 0.5 },
  sliderValue:      { fontFamily: 'monospace', fontSize: 10, fontWeight: '600', color: '#1A261A' },
  slider:           { width: '100%', height: 24 },
  subLabel:         { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', letterSpacing: 0.5, marginBottom: 6 },
  stageRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  stageBtn:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#DDEADD' },
  stageBtnActive:   { borderColor: '#16A34A', backgroundColor: '#F0FFF4' },
  stageBtnText:     { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', letterSpacing: 0.5 },
  stageBtnTextActive:{ color: '#16A34A' },
  toggleRow:        { flexDirection: 'row', gap: 8 },
  toggleBtn:        { flex: 1, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: '#DDEADD', alignItems: 'center' },
  toggleBtnText:    { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 0.5 },
})

// data panel styles
const dp = StyleSheet.create({
  card:        { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 14, minWidth: 170, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  title:       { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#EAEDEA' },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label:       { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', letterSpacing: 0.5 },
  value:       { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: '#1A261A' },
  divider:     { height: 1, backgroundColor: '#EAEDEA', marginVertical: 6 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  progressBg:  { height: 3, backgroundColor: '#EAEDEA', borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFill:{ height: '100%', borderRadius: 2 },
})
