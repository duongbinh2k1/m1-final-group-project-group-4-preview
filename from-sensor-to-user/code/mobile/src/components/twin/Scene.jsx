/**
 * Mobile 2D "Digital Twin" — replaces the Three.js 3D scene.
 * Three.js (@react-three/fiber) is not supported in Expo Go.
 * This renders a top-down schematic of the greenhouse using native Views.
 */
import { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

// ─── helpers ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function tempStress(temp) {
  if (temp <= 22) return Math.max(-1, (temp - 22) / 10)
  if (temp >= 28) return Math.min( 1, (temp - 28) / 10)
  return 0
}

function soilColor(moisture) {
  // dry (0%) → tan, moist (100%) → dark brown
  const t = clamp(moisture / 100, 0, 1)
  const r = Math.round(122 - t * (122 - 44))
  const g = Math.round(80  - t * (80  - 24))
  const b = Math.round(48  - t * (48  - 10))
  return `rgb(${r},${g},${b})`
}

const STATUS_COLORS = {
  healthy:  '#F8EDD4',
  warning:  '#D4C070',
  critical: '#7A6040',
  null:     '#F8EDD4',
}

// ─── Mushroom icon (SVG-free, pure View) ─────────────────────────────────────

function Mushroom({ capColor, size = 28 }) {
  const stem = size * 0.25
  const cap  = size * 0.55
  return (
    <View style={{ alignItems: 'center' }}>
      {/* cap */}
      <View style={{
        width: cap * 2, height: cap,
        backgroundColor: capColor,
        borderRadius: cap,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.12)',
      }} />
      {/* stem */}
      <View style={{
        width: stem, height: size * 0.35,
        backgroundColor: '#FFF8EC',
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)',
      }} />
    </View>
  )
}

// ─── FanIcon ──────────────────────────────────────────────────────────────────

function FanIcon({ active }) {
  const rot = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.timing(rot, { toValue: 1, duration: 800, useNativeDriver: true })
      ).start()
    } else {
      rot.stopAnimation()
      rot.setValue(0)
    }
  }, [active])
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Text style={{ fontSize: 20 }}>⊕</Text>
    </Animated.View>
  )
}

// ─── WaterDrop animation ──────────────────────────────────────────────────────

function PumpDrip({ active }) {
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ])
      ).start()
    } else {
      opacity.stopAnimation()
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start()
    }
  }, [active])
  return (
    <Animated.Text style={{ fontSize: 16, opacity }}>💧</Animated.Text>
  )
}

// ─── Main Scene ───────────────────────────────────────────────────────────────

export function Scene({ environment, devices, ai }) {
  const temp     = environment?.air_temperature ?? 24
  const hum      = environment?.air_humidity    ?? 80
  const soil     = environment?.soil_moisture   ?? 60
  const fanOn    = devices?.fan  === true
  const pumpOn   = devices?.pump === true
  const status   = ai?.status ?? null

  const ts        = tempStress(temp)
  const capColor  = STATUS_COLORS[status] ?? STATUS_COLORS.null
  const bgColor   = ts < -0.3 ? '#E0EAF5' : ts > 0.6 ? '#F5EDE5' : '#EDF2ED'
  const fogOpacity = clamp((hum - 55) / 50, 0, 0.22)

  // temperature tint overlay
  const tempTint = ts > 0.5
    ? `rgba(220,80,20,${clamp((ts - 0.5) * 0.25, 0, 0.15)})`
    : ts < -0.3
    ? `rgba(100,160,220,${clamp((-ts - 0.3) * 0.3, 0, 0.15)})`
    : 'transparent'

  return (
    <View style={[s.container, { backgroundColor: bgColor }]}>

      {/* temperature tint */}
      {tempTint !== 'transparent' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tempTint }]} pointerEvents="none" />
      )}

      {/* humidity fog overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(200,220,240,${fogOpacity})` }]} pointerEvents="none" />

      {/* ── greenhouse box ─────────────────────────────────── */}
      <View style={s.greenhouse}>

        {/* grow light bar */}
        <View style={s.lightBar}>
          <View style={s.lightGlow} />
        </View>

        {/* soil bed */}
        <View style={[s.soilBed, { backgroundColor: soilColor(soil) }]}>
          {/* mushroom clusters */}
          <View style={s.mushroomRow}>
            {[0.85, 1.0, 0.75, 1.0, 0.85].map((scale, i) => (
              <View key={i} style={{ transform: [{ scale }], marginHorizontal: 4 }}>
                <Mushroom capColor={capColor} size={28} />
              </View>
            ))}
          </View>
          <View style={s.mushroomRow2}>
            {[0.7, 0.9, 0.7].map((scale, i) => (
              <View key={i} style={{ transform: [{ scale }], marginHorizontal: 8 }}>
                <Mushroom capColor={capColor} size={22} />
              </View>
            ))}
          </View>
        </View>

        {/* glass walls */}
        <View style={s.wallLeft}  />
        <View style={s.wallRight} />

        {/* drip irrigation rail */}
        <View style={s.dripRail}>
          <View style={s.dripLine} />
          {[0.2, 0.4, 0.6, 0.8].map((pos) => (
            <View key={pos} style={[s.dripHead, { left: `${pos * 100}%` }]}>
              <PumpDrip active={pumpOn} />
            </View>
          ))}
        </View>

        {/* frost overlay */}
        {ts < -0.3 && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: `rgba(220,240,255,${clamp((-ts - 0.3) * 0.35, 0, 0.28)})`,
            borderRadius: 12,
          }]} pointerEvents="none">
            <Text style={s.frostText}>❄ {temp.toFixed(0)}°C</Text>
          </View>
        )}

        {/* heat shimmer label */}
        {ts > 0.5 && (
          <View style={s.heatBadge}>
            <Text style={s.heatText}>🌡 {temp.toFixed(0)}°C</Text>
          </View>
        )}
      </View>

      {/* ── device badges ──────────────────────────────────── */}
      <View style={s.deviceRow}>
        {/* Fan */}
        <View style={[s.deviceBadge, fanOn && s.deviceBadgeActive]}>
          <FanIcon active={fanOn} />
          <Text style={[s.deviceLabel, fanOn && { color: '#D97706' }]}>
            fan {fanOn ? 'ON' : 'OFF'}
          </Text>
        </View>

        {/* Pump */}
        <View style={[s.deviceBadge, pumpOn && { borderColor: '#0891B2', backgroundColor: 'rgba(8,145,178,0.07)' }]}>
          <Text style={{ fontSize: 20 }}>⛽</Text>
          <Text style={[s.deviceLabel, pumpOn && { color: '#0891B2' }]}>
            pump {pumpOn ? 'ON' : 'OFF'}
          </Text>
        </View>
      </View>

      {/* ── legend ─────────────────────────────────────────── */}
      <View style={s.legend}>
        <Text style={s.legendText}>2D schematic — drag disabled on mobile</Text>
      </View>
    </View>
  )
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  greenhouse:  {
    width: '100%', aspectRatio: 1.6,
    borderWidth: 2, borderColor: 'rgba(100,160,200,0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(230,242,230,0.5)',
    overflow: 'hidden',
    position: 'relative',
  },

  lightBar:    { height: 10, backgroundColor: '#FFE890', marginHorizontal: 16, marginTop: 8, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  lightGlow:   { position: 'absolute', height: 18, left: 0, right: 0, backgroundColor: 'rgba(255,232,80,0.15)', borderRadius: 8 },

  soilBed:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%', borderTopLeftRadius: 4, borderTopRightRadius: 4, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 4 },
  mushroomRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  mushroomRow2:{ flexDirection: 'row', alignItems: 'flex-end' },

  wallLeft:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(100,160,200,0.25)' },
  wallRight:   { position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(100,160,200,0.25)' },

  dripRail:    { position: 'absolute', top: 22, left: 12, right: 12, height: 24 },
  dripLine:    { position: 'absolute', left: 0, right: 0, top: 4, height: 3, backgroundColor: '#2E7D9A', borderRadius: 2 },
  dripHead:    { position: 'absolute', top: 0, transform: [{ translateX: -8 }] },

  frostText:   { color: '#4A7AAA', fontFamily: 'monospace', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  heatBadge:   { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(220,80,20,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  heatText:    { color: '#C0400A', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },

  deviceRow:   { flexDirection: 'row', gap: 12, marginTop: 14 },
  deviceBadge: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#DDEADD', backgroundColor: '#FAFBFA' },
  deviceBadgeActive: { borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.07)' },
  deviceLabel: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', color: '#9BB09B', letterSpacing: 0.5, textTransform: 'uppercase' },

  legend:      { marginTop: 8 },
  legendText:  { fontFamily: 'monospace', fontSize: 8, color: '#B0C0B0', letterSpacing: 0.3 },
})
