import { useEffect, useRef, useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import Slider from '@react-native-community/slider'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { api } from '../services/api'
import { useGreenhouseStore } from '../store/useGreenhouseStore'

const MODES = [
  { key: 'off',    label: 'OFF',    desc: 'All actuators forced off.',       color: '#DC2626', bg: 'rgba(220,38,38,0.07)'  },
  { key: 'auto',   label: 'AUTO',   desc: 'ML classifier decides.',          color: '#16A34A', bg: 'rgba(22,163,74,0.07)'   },
  { key: 'manual', label: 'MANUAL', desc: 'Custom thresholds override.',     color: '#D97706', bg: 'rgba(217,119,6,0.07)'  },
]

const PUMP_DURATIONS = [
  { label: '30s', value: 30 }, { label: '1m', value: 60 },
  { label: '2m', value: 120 }, { label: '5m', value: 300 }, { label: '10m', value: 600 },
]

const DEFAULT_THRESHOLDS = { temp_fan_on: 30.0, humidity_fan_on: 50.0, soil_pump_on: 25.0 }

function SectionLabel({ children }) {
  return (
    <Text style={styles.sectionLabel}>{children}</Text>
  )
}

function ThresholdRow({ label, hint, value, min, max, step, unit, color, onChange }) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderHint}>{hint}</Text>
        <Text style={[styles.sliderValue, { color }]}>{Number(value).toFixed(1)}{unit}</Text>
      </View>
      <Slider
        value={value} minimumValue={min} maximumValue={max} step={step}
        onValueChange={onChange}
        minimumTrackTintColor={color}
        maximumTrackTintColor="#EAEDEA"
        thumbTintColor={color}
      />
    </View>
  )
}

export function ControlScreen() {
  const storeControl = useGreenhouseStore(s => s.control)

  const [mode,       setMode]       = useState('auto')
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [loading,    setLoading]    = useState(false)

  // Remote toggle state (null=auto, true=force ON, false=force OFF)
  const [fanState,      setFanState]      = useState(null)
  const [pumpState,     setPumpState]     = useState(null)
  const [pumpDur,       setPumpDur]       = useState(120)
  const [pumpCountdown, setPumpCountdown] = useState(0)
  const countdownRef = useRef(null)

  useEffect(() => {
    api.getControl()
      .then(d => { setMode(d.mode); setThresholds({ ...DEFAULT_THRESHOLDS, ...d.thresholds }) })
      .catch(() => {
        if (storeControl) {
          setMode(storeControl.mode)
          setThresholds({ ...DEFAULT_THRESHOLDS, ...storeControl.thresholds })
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!storeControl) return
    setMode(storeControl.mode)
    setThresholds({ ...DEFAULT_THRESHOLDS, ...storeControl.thresholds })
  }, [storeControl])

  useEffect(() => () => clearInterval(countdownRef.current), [])

  async function handleApply() {
    setLoading(true)
    try {
      const res = await api.setControl({ mode, thresholds })
      if (res?._mqttDown) {
        Alert.alert('Config saved', 'MQTT offline — firmware will receive config on reconnect.')
      } else {
        Alert.alert('Applied', 'Config sent to firmware.')
      }
    } catch {
      Alert.alert('Error', 'Could not apply config. Check backend connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFanToggle() {
    const next = fanState === null ? true : fanState === true ? false : null
    const prev = fanState
    setFanState(next)
    try {
      await api.sendCommand({ device: 'fan', state: next })
    } catch {
      setFanState(prev)
      Alert.alert('Error', 'Fan command failed. MQTT may be offline.')
    }
  }

  async function handlePumpToggle() {
    const next = pumpState === null ? true : pumpState === true ? false : null
    const prev = pumpState
    setPumpState(next)
    clearInterval(countdownRef.current)

    if (next === true) {
      setPumpCountdown(pumpDur)
      countdownRef.current = setInterval(() => {
        setPumpCountdown(c => {
          if (c <= 1) { clearInterval(countdownRef.current); setPumpState(null); return 0 }
          return c - 1
        })
      }, 1000)
    } else {
      setPumpCountdown(0)
    }

    try {
      await api.sendCommand({ device: 'pump', state: next, ...(next === true && { duration: pumpDur }) })
    } catch {
      setPumpState(prev)
      clearInterval(countdownRef.current)
      setPumpCountdown(0)
      Alert.alert('Error', 'Pump command failed. MQTT may be offline.')
    }
  }

  const activeMode = MODES.find(m => m.key === mode)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>control</Text>
        <ConnectionBadge />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Remote toggle */}
        <SectionLabel>// remote_control</SectionLabel>
        <View style={styles.card}>
          {/* Fan */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleName}>cooling_fan</Text>
              <Text style={styles.toggleDesc}>Toggle regardless of mode</Text>
            </View>
            <TouchableOpacity
              onPress={handleFanToggle}
              style={[styles.toggleBtn, {
                borderColor: fanState === true ? 'rgba(217,119,6,0.4)' : fanState === false ? 'rgba(220,38,38,0.3)' : '#DDEADD',
                backgroundColor: fanState === true ? 'rgba(217,119,6,0.10)' : fanState === false ? 'rgba(220,38,38,0.07)' : '#F5F6F8',
              }]}
            >
              <Text style={[styles.toggleBtnText, {
                color: fanState === true ? '#D97706' : fanState === false ? '#DC2626' : '#9BB09B',
              }]}>
                {fanState === true ? '▲ ON' : fanState === false ? '▼ OFF' : '— AUTO'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Pump */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleName}>water_pump</Text>
              <Text style={styles.toggleDesc}>Auto-off after selected duration</Text>
              <View style={styles.durRow}>
                {PUMP_DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => { if (pumpState !== true) setPumpDur(d.value) }}
                    disabled={pumpState === true}
                    style={[styles.durBtn, pumpDur === d.value && { borderColor: '#0891B2', backgroundColor: 'rgba(8,145,178,0.08)' }]}
                  >
                    <Text style={[styles.durBtnText, pumpDur === d.value && { color: '#0891B2' }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity
                onPress={handlePumpToggle}
                style={[styles.toggleBtn, {
                  borderColor: pumpState === true ? 'rgba(8,145,178,0.4)' : pumpState === false ? 'rgba(220,38,38,0.3)' : '#DDEADD',
                  backgroundColor: pumpState === true ? 'rgba(8,145,178,0.10)' : pumpState === false ? 'rgba(220,38,38,0.07)' : '#F5F6F8',
                }]}
              >
                <Text style={[styles.toggleBtnText, {
                  color: pumpState === true ? '#0891B2' : pumpState === false ? '#DC2626' : '#9BB09B',
                }]}>
                  {pumpState === true ? '▲ ON' : pumpState === false ? '▼ OFF' : '— AUTO'}
                </Text>
              </TouchableOpacity>
              {pumpState === true && pumpCountdown > 0 && (
                <Text style={styles.countdownText}>
                  {pumpCountdown < 60 ? `${pumpCountdown}s` : `${Math.floor(pumpCountdown/60)}m ${pumpCountdown%60}s`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Mode selector */}
        <SectionLabel>// actuator_mode</SectionLabel>
        <View style={styles.modeRow}>
          {MODES.map(m => {
            const active = mode === m.key
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[styles.modeBtn, active && { backgroundColor: m.bg, borderColor: m.color + '50', borderWidth: 2 }]}
              >
                <View style={[styles.modeDot, { backgroundColor: active ? m.color : '#C0D0C0' }]} />
                <Text style={[styles.modeBtnLabel, { color: active ? m.color : '#9BB09B' }]}>{m.label}</Text>
                <Text style={styles.modeBtnDesc}>{m.desc}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Manual thresholds */}
        {mode === 'manual' && (
          <>
            <SectionLabel>// manual_thresholds</SectionLabel>
            <View style={styles.card}>
              <ThresholdRow
                label="temp_fan_on" hint="fan ON above" unit="°C" color="#D97706"
                value={thresholds.temp_fan_on} min={15} max={45} step={0.5}
                onChange={v => setThresholds(p => ({ ...p, temp_fan_on: v }))}
              />
              <ThresholdRow
                label="humidity_fan_on" hint="fan ON below" unit="%" color="#D97706"
                value={thresholds.humidity_fan_on} min={20} max={95} step={1}
                onChange={v => setThresholds(p => ({ ...p, humidity_fan_on: v }))}
              />
              <ThresholdRow
                label="soil_pump_on" hint="pump ON below" unit="%" color="#0891B2"
                value={thresholds.soil_pump_on} min={5} max={60} step={1}
                onChange={v => setThresholds(p => ({ ...p, soil_pump_on: v }))}
              />
            </View>
          </>
        )}

        {/* Apply */}
        <TouchableOpacity
          onPress={handleApply}
          disabled={loading}
          style={[styles.applyBtn, { backgroundColor: loading ? '#C0D0C0' : (activeMode?.color ?? '#16A34A') }]}
        >
          <Text style={styles.applyBtnText}>{loading ? 'applying...' : 'apply_config'}</Text>
        </TouchableOpacity>

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
  card:          { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  divider:       { height: 1, backgroundColor: '#EAEDEA', marginVertical: 14 },
  toggleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  toggleName:    { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: '#1A261A', marginBottom: 2 },
  toggleDesc:    { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', marginBottom: 8 },
  toggleBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5, minWidth: 88, alignItems: 'center' },
  toggleBtnText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  durRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  durBtn:        { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#DDEADD' },
  durBtnText:    { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B' },
  countdownText: { fontFamily: 'monospace', fontSize: 10, color: '#0891B2' },
  modeRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn:       { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'flex-start', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  modeDot:       { width: 7, height: 7, borderRadius: 4, marginBottom: 6 },
  modeBtnLabel:  { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  modeBtnDesc:   { fontFamily: 'monospace', fontSize: 8, color: '#9BB09B', lineHeight: 12 },
  sliderRow:     { marginBottom: 16 },
  sliderLabelRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sliderLabel:   { fontFamily: 'monospace', fontSize: 10, fontWeight: '600', color: '#1A261A', flex: 1 },
  sliderHint:    { fontFamily: 'monospace', fontSize: 9, color: '#9BB09B', marginRight: 8 },
  sliderValue:   { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  applyBtn:      { borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  applyBtnText:  { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' },
})
