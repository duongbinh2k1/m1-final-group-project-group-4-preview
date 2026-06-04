import { useRef, useMemo, Suspense, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// ─── helpers ─────────────────────────────────────────────────────────────────

function sr(n) { const x = Math.sin(n + 1) * 10000; return x - Math.floor(x) }

const SOIL_H = 0.18

function tH(x, z) {
  return 0.074
    + Math.sin(x*4.4+1.1)*Math.cos(z*3.7+0.6)*0.036
    + Math.sin(x*8.8+z*6.8)*0.014
    + Math.cos(x*5.9-z*5.2)*0.021
}

// -1 (extreme cold 12°C) → 0 (optimal 22–28°C) → +1 (extreme hot 38°C)
function calcTempStress(temp) {
  if (temp <= 22) return Math.max(-1, (temp - 22) / 10)
  if (temp >= 28) return Math.min( 1, (temp - 28) / 10)
  return 0
}

// Shift cap color based on temperature stress
function stressColor(hex, ts) {
  const c = new THREE.Color(hex)
  if (ts < 0)    return '#' + c.lerp(new THREE.Color('#B8D4F8'), Math.min(1, -ts * 0.85)).getHexString()
  if (ts <= 0.5) return '#' + c.lerp(new THREE.Color('#D4A030'), ts * 2).getHexString()
  return '#' + new THREE.Color('#D4A030').lerp(new THREE.Color('#6B3010'), (ts - 0.5) * 2).getHexString()
}

function easeOutBack(t) {
  const c1 = 1.4, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ─── box constants ────────────────────────────────────────────────────────────

const HW = 0.96
const HH = 0.78
const HD = 0.66

// ─── precomputed frost crystal positions ─────────────────────────────────────

const FROST_POS = Array.from({ length: 44 }, (_, i) => ({
  x:   (sr(i*31)   - 0.5) * HW*2*0.82,
  y:   (sr(i*31+1) - 0.5) * HH*2*0.82,
  s:    0.022 + sr(i*31+2)*0.038,
  rot:  sr(i*31+3) * Math.PI,
}))

// ─── terrarium base tray ──────────────────────────────────────────────────────

function TerrariumBase() {
  return (
    <mesh position={[0, -0.026, 0]} castShadow receiveShadow>
      <boxGeometry args={[HW*2+0.10, 0.052, HD*2+0.10]} />
      <meshStandardMaterial color="#CFD8D2" metalness={0.35} roughness={0.52} />
    </mesh>
  )
}

// ─── glass + condensation drops ───────────────────────────────────────────────

function TerrariumGlass() {
  const W = HW*2, H = HH*2, D = HD*2
  const drops = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      x:    (sr(i*17)   - 0.5) * W * 0.78,
      y:    (sr(i*17+1) - 0.5) * H * 0.78,
      r:     0.010 + sr(i*17+2) * 0.020,
      left:  i % 4 === 0,
    }))
  , [W, H])

  return (
    <group position={[0, HH, 0]}>
      <RoundedBox args={[W, H, D]} radius={0.036} smoothness={4} renderOrder={1}>
        <meshStandardMaterial
          color="#C8E4F4" transparent opacity={0.07}
          roughness={0.02} metalness={0.04}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </RoundedBox>
      {drops.map((d, i) => (
        <mesh key={i}
          position={d.left ? [-HW+0.002, d.y, d.x*0.65] : [d.x, d.y, HD+0.003]}
          rotation={d.left ? [0, Math.PI/2, 0] : [0,0,0]}
          renderOrder={2}
        >
          <circleGeometry args={[d.r, 7]} />
          <meshStandardMaterial color="#B8D8F0" transparent opacity={0.40} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ─── terrain ─────────────────────────────────────────────────────────────────

function Terrain({ soilMoisture = 60 }) {
  const sW = HW*2 - 0.01
  const sD = HD*2 - 0.01
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(sW, sD, 26, 20)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position.array
    for (let i = 0; i < p.length; i += 3) p[i+1] = SOIL_H + tH(p[i], p[i+2])
    g.computeVertexNormals()
    return g
  }, [sW, sD])

  // dry (0%) → light tan #7A5030, moist (100%) → dark brown #2C180A
  const t      = Math.max(0, Math.min(1, soilMoisture / 100))
  const surfColor = useMemo(() => '#' + new THREE.Color('#7A5030').lerp(new THREE.Color('#3C2214'), t).getHexString(), [t])
  const baseColor = useMemo(() => '#' + new THREE.Color('#5A3820').lerp(new THREE.Color('#2C180A'), t).getHexString(), [t])

  return (
    <>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={surfColor} roughness={0.96} />
      </mesh>
      <mesh position={[0, SOIL_H*0.5, 0]}>
        <boxGeometry args={[sW, SOIL_H, sD]} />
        <meshStandardMaterial color={baseColor} roughness={0.98} />
      </mesh>
    </>
  )
}

// ─── moss patches ─────────────────────────────────────────────────────────────

const MOSS_POS    = [[-0.55,0.12],[-0.28,-0.28],[0.15,0.25],[0.48,-0.15],[-0.72,-0.08],[0.62,0.18],[-0.10,-0.42],[0.35,0.42]]
const MOSS_COLORS = ['#3E7048','#486C50','#527A58','#3A6642']

function MossPatches() {
  return (
    <>
      {MOSS_POS.map(([x,z],i) => (
        <mesh key={i}
          position={[x, SOIL_H+tH(x,z)+0.003, z]}
          rotation={[-Math.PI/2, 0, sr(i*11+1)*Math.PI*2]}
          scale={0.7+sr(i*11)*0.7} receiveShadow
        >
          <circleGeometry args={[0.1,9]} />
          <meshStandardMaterial color={MOSS_COLORS[i%MOSS_COLORS.length]} roughness={0.96} />
        </mesh>
      ))}
    </>
  )
}

// ─── grass tufts ──────────────────────────────────────────────────────────────

const GRASS_POS = [[-0.65,0.32],[0.55,-0.38],[-0.20,0.50],[0.72,0.30],[-0.45,-0.50],[0.08,-0.55],[0.82,-0.12]]

function GrassBlade({ x, y, z, seed }) {
  const h = 0.038 + sr(seed+2)*0.028
  return (
    <mesh
      position={[x+(sr(seed+3)-0.5)*0.025, y+h/2, z+(sr(seed+4)-0.5)*0.025]}
      rotation={[(sr(seed)-0.5)*0.35, sr(seed+1)*Math.PI*2, (sr(seed+5)-0.5)*0.2]}
    >
      <coneGeometry args={[0.005, h, 4]} />
      <meshStandardMaterial color={sr(seed)>0.5 ? '#5CB068' : '#4EA85A'} roughness={0.9} />
    </mesh>
  )
}

function GrassTufts() {
  return (
    <>
      {GRASS_POS.map(([gx,gz],gi) =>
        Array.from({length:4},(_,bi) => {
          const seed = gi*50+bi*7
          return <GrassBlade key={bi} x={gx} y={SOIL_H+tH(gx,gz)+0.001} z={gz} seed={seed} />
        })
      )}
    </>
  )
}

// ─── pebbles ──────────────────────────────────────────────────────────────────

const PEBBLE_POS = [[-0.80,0.44],[0.78,-0.42],[0.60,0.52],[-0.30,0.58],[0.88,0.02],[-0.88,-0.38],[0.25,-0.58]]

function Pebbles() {
  return (
    <>
      {PEBBLE_POS.map(([px,pz],i) => (
        <mesh key={i}
          position={[px, SOIL_H+tH(px,pz)+0.020, pz]}
          scale={[(0.75+sr(i*13)*0.5)*0.038,(0.45+sr(i*13+1)*0.35)*0.038,(0.75+sr(i*13+2)*0.5)*0.038]}
          rotation={[sr(i)*Math.PI,sr(i+1)*Math.PI,0]}
        >
          <icosahedronGeometry args={[1,1]} />
          <meshStandardMaterial color={sr(i*13+3)>0.5 ? '#B8B2AA' : '#A8A49C'} roughness={0.88} />
        </mesh>
      ))}
    </>
  )
}

// ─── chibi mushrooms ──────────────────────────────────────────────────────────

// Status = health condition, NOT growth stage.
// All mushrooms are same-size adults — differentiate by COLOR & appearance only.
const STAGE_CFG = {
  healthy:  { cap:'#F8EDD4', stem:'#FFF8EC', baseScale:1.00, count:7, spots:true  }, // cream, white spots — vibrant
  warning:  { cap:'#C8A430', stem:'#D4B870', baseScale:1.00, count:7, spots:false }, // yellow-ochre — nutrient stress / over-watered
  critical: { cap:'#7A6040', stem:'#A09060', baseScale:1.00, count:7, spots:false }, // dark brown — rotting / seriously diseased
}

function ChibiMushroom({ px, py, pz, scale=1, rotY=0, capColor, stemColor, spots, delay=0, lean=0 }) {
  const sh  = 0.095 * scale
  const cr  = 0.088 * scale
  const str = 0.042 * scale
  const ref = useRef()
  const t   = useRef(0)
  const cl  = useRef(0)  // current lean (smoothed)

  // Initialize scale to 0 before first paint
  useLayoutEffect(() => { if (ref.current) ref.current.scale.setScalar(0) }, [])

  useFrame((_, dt) => {
    if (!ref.current) return
    // Growth animation
    t.current += dt
    const p = Math.max(0, Math.min(1, (t.current - delay) / 1.8))
    ref.current.scale.setScalar(Math.max(0, p < 1 ? easeOutBack(p) : 1))
    // Smooth lean (wilt when hot)
    cl.current += (lean - cl.current) * Math.min(1, dt * 2)
    ref.current.rotation.x = cl.current * 0.45
    ref.current.rotation.y = rotY
  })

  return (
    <group ref={ref} position={[px, py, pz]}>
      <mesh position={[0,sh+0.002,0]}>
        <cylinderGeometry args={[cr*0.94,cr*0.94,0.004,9]} />
        <meshStandardMaterial color="#E8D8C8" roughness={0.92} />
      </mesh>
      <mesh position={[0,sh*0.5,0]} castShadow>
        <cylinderGeometry args={[str,str*1.15,sh,8]} />
        <meshStandardMaterial color={stemColor} roughness={0.82} />
      </mesh>
      <mesh position={[0,sh+cr*0.3,0]} scale={[1,0.72,1]} castShadow>
        <sphereGeometry args={[cr,11,9,0,Math.PI*2,0,Math.PI*0.84]} />
        <meshStandardMaterial color={capColor} roughness={0.62} />
      </mesh>
      {spots && [0,1,2].map(k => {
        const a=k*Math.PI*2/3+1.2, rd=cr*0.48
        return (
          <mesh key={k} position={[Math.cos(a)*rd,sh+cr*0.72,Math.sin(a)*rd]} scale={[1,0.28,1]}>
            <sphereGeometry args={[cr*0.16,6,5]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.55} />
          </mesh>
        )
      })}
    </group>
  )
}

const CLUSTER_DEFS = [{cx:-0.38,cz:0.08},{cx:0.30,cz:-0.20},{cx:-0.55,cz:-0.30},{cx:0.55,cz:0.28}]

function MushroomBed({ stage, tempStress: ts }) {
  const cfg      = STAGE_CFG[stage] ?? STAGE_CFG.healthy
  const capColor = useMemo(() => stressColor(cfg.cap, ts ?? 0), [cfg.cap, ts])
  const lean     = Math.pow(Math.max(0, (ts ?? 0) - 0.3) / 0.7, 1.5) * 0.8

  const placements = useMemo(() =>
    CLUSTER_DEFS.flatMap(({cx,cz},ci) =>
      Array.from({length:cfg.count},(_,i) => {
        const base = ci*200+i*7
        const x = cx+(sr(base)-0.5)*0.28
        const z = cz+(sr(base+1)-0.5)*0.18
        return { px:x, pz:z, py:SOIL_H+tH(x,z), scale:cfg.baseScale*(0.62+sr(base+2)*0.76), rotY:sr(base+3)*Math.PI*2, delay:ci*0.55+i*0.07 }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [stage])

  return (
    <>
      {placements.map((p,i) => (
        <ChibiMushroom key={`${stage}-${i}`}
          px={p.px} py={p.py} pz={p.pz}
          scale={p.scale} rotY={p.rotY}
          capColor={capColor} stemColor={cfg.stem}
          spots={cfg.spots && p.scale > cfg.baseScale*0.8}
          delay={p.delay} lean={lean}
        />
      ))}
    </>
  )
}

// ─── grow light ───────────────────────────────────────────────────────────────

function GrowLight() {
  return (
    <group position={[0, HH*2-0.05, 0]}>
      <mesh>
        <boxGeometry args={[1.4,0.032,0.06]} />
        <meshStandardMaterial color="#FFE890" emissive="#FFE060" emissiveIntensity={1.8} roughness={0.3} />
      </mesh>
      <pointLight position={[0,-0.06,0]} color="#FFE890" intensity={2.4} distance={2.6} decay={2} />
    </group>
  )
}

// ─── mini fan ─────────────────────────────────────────────────────────────────

function MiniFan({ active }) {
  const bladesRef = useRef()
  useFrame((_,dt) => { if (bladesRef.current) bladesRef.current.rotation.z += active ? dt*8.5 : 0 })
  return (
    <group position={[HW-0.04,HH*2-0.12,-HD+0.04]} rotation={[0,-Math.PI*0.25,0]}>
      <mesh rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[0.085,0.009,7,16]} />
        <meshStandardMaterial color="#A8B0B2" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={bladesRef}>
        {[0,1,2,3].map(k => {
          const a=k*Math.PI/2
          return (
            <mesh key={k} position={[Math.cos(a)*0.038,Math.sin(a)*0.038,0]} rotation={[0,0,a+0.3]}>
              <boxGeometry args={[0.07,0.022,0.007]} />
              <meshStandardMaterial color="#C8D0D2" metalness={0.4} roughness={0.45} />
            </mesh>
          )
        })}
        <mesh><sphereGeometry args={[0.014,7,7]}/><meshStandardMaterial color="#909898" metalness={0.7}/></mesh>
      </group>
    </group>
  )
}

// ─── water pump + drip irrigation ────────────────────────────────────────────

function WaterPump({ active }) {
  const N = 140
  const TUBE_Y = HH * 2 - 0.11

  const [pos, spd, resetX, resetZ] = useMemo(() => {
    const p  = new Float32Array(N * 3)
    const s  = new Float32Array(N)
    const rx = new Float32Array(N)
    const rz = new Float32Array(N)
    // Drip points spread along the two tube axes
    for (let i = 0; i < N; i++) {
      rx[i] = (Math.random() - 0.5) * (HW * 2 - 0.18)
      rz[i] = (Math.random() - 0.5) * (HD * 2 - 0.18)
      p[i*3]   = rx[i]
      p[i*3+1] = TUBE_Y - Math.random() * (HH * 2 - SOIL_H - 0.15)  // stagger initial Y
      p[i*3+2] = rz[i]
      s[i] = 0.28 + Math.random() * 0.45
    }
    return [p, s, rx, rz]
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const attrRef = useRef()
  useFrame((_, dt) => {
    if (!attrRef.current || !active) return
    const a = attrRef.current.array
    for (let i = 0; i < N; i++) {
      a[i*3+1] -= dt * spd[i]              // fall downward
      if (a[i*3+1] < SOIL_H + 0.01) {      // reset to drip tube
        a[i*3]   = resetX[i]
        a[i*3+1] = TUBE_Y
        a[i*3+2] = resetZ[i]
      }
    }
    attrRef.current.needsUpdate = true
  })

  // Pump body position: front-left corner, at base
  const px = -HW + 0.05
  const pz = -HD + 0.05

  return (
    <group>
      {/* Pump body */}
      <mesh position={[px, 0.045, pz]} castShadow>
        <boxGeometry args={[0.072, 0.090, 0.054]} />
        <meshStandardMaterial
          color={active ? '#1A5F7A' : '#3A5A68'}
          roughness={0.55} metalness={0.45}
        />
      </mesh>

      {/* Status LED on pump */}
      <mesh position={[px, 0.096, pz + 0.028]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshStandardMaterial
          color={active ? '#22D3EE' : '#1A3040'}
          emissive={active ? '#22D3EE' : '#000000'}
          emissiveIntensity={active ? 3.5 : 0}
        />
      </mesh>

      {/* Horizontal drip rail — X axis */}
      <mesh position={[0, TUBE_Y, pz]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, HW * 2 - 0.08, 8]} />
        <meshStandardMaterial color="#2E7D9A" roughness={0.5} metalness={0.35} />
      </mesh>

      {/* Horizontal drip rail — Z axis (cross pipe) */}
      <mesh position={[px, TUBE_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, HD * 2 - 0.08, 8]} />
        <meshStandardMaterial color="#2E7D9A" roughness={0.5} metalness={0.35} />
      </mesh>

      {/* Falling water drops */}
      <points visible={active}>
        <bufferGeometry>
          <bufferAttribute
            ref={attrRef}
            attach="attributes-position"
            count={N}
            array={pos}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#7DD8F8"
          size={0.013}
          transparent
          opacity={0.75}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  )
}

// ─── heat shimmer (temp > 33°C) ───────────────────────────────────────────────

function HeatShimmer({ stress }) {
  const N         = 100
  const active    = stress > 0.5
  const intensity = Math.max(0, (stress - 0.5) / 0.5)

  const [pos, spd, drift] = useMemo(() => {
    const p=new Float32Array(N*3), s=new Float32Array(N), d=new Float32Array(N)
    for (let i=0;i<N;i++) {
      p[i*3]  =(Math.random()-0.5)*(HW*2-0.20)
      p[i*3+1]=SOIL_H+Math.random()*(HH*1.4)
      p[i*3+2]=(Math.random()-0.5)*(HD*2-0.20)
      s[i]=0.20+Math.random()*0.30
      d[i]=(Math.random()-0.5)*0.10
    }
    return [p,s,d]
  },[])

  const attrRef = useRef()
  useFrame((_,dt) => {
    if (!attrRef.current||!active) return
    const a=attrRef.current.array
    for (let i=0;i<N;i++) {
      a[i*3]  +=dt*drift[i]
      a[i*3+1]+=dt*spd[i]
      if (a[i*3+1]>SOIL_H+HH*1.4) a[i*3+1]=SOIL_H+0.05
    }
    attrRef.current.needsUpdate=true
  })

  return (
    <points visible={active}>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" count={N} array={pos} itemSize={3}/>
      </bufferGeometry>
      <pointsMaterial color="#F89828" size={0.013} transparent opacity={0.28*intensity} sizeAttenuation depthWrite={false}/>
    </points>
  )
}

// ─── frost crystals (temp < 18°C) ─────────────────────────────────────────────

function FrostCrystals({ stress }) {
  const opacity = Math.max(0, Math.min(0.88, (-stress - 0.15) / 0.85 * 0.88))
  if (opacity <= 0.01) return null

  return (
    <group position={[0, HH, 0]}>
      {FROST_POS.map((c, i) => (
        <group key={i} position={[c.x, c.y, HD+0.006]} rotation={[0,0,c.rot]}>
          {/* 3 arms = 6-pointed snowflake */}
          {[0, Math.PI/3, Math.PI*2/3].map((a, j) => (
            <mesh key={j} rotation={[0,0,a]}>
              <boxGeometry args={[c.s, c.s*0.10, 0.001]} />
              <meshStandardMaterial
                color="#DCF0FF" transparent opacity={opacity}
                depthWrite={false} emissive="#A8D4F8" emissiveIntensity={0.35}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ─── scene content ────────────────────────────────────────────────────────────

function SceneContent({ environment, devices, ai }) {
  const { scene } = useThree()

  const temp   = environment?.air_temperature ?? 24
  const hum    = environment?.air_humidity    ?? 80
  const soil   = environment?.soil_moisture   ?? 60
  const stage  = ai?.status  ?? null
  const fanOn  = devices?.fan  === true
  const pumpOn = devices?.pump === true

  const ts = calcTempStress(temp)

  // Smoothly update fog density (humidity) + color (temperature) each frame
  useFrame(() => {
    if (!scene.fog) return
    const wet  = Math.max(0, Math.min(1, (hum - 55) / 50))
    const near = 3 + (1 - wet) * 5    // wet→3, dry→8
    const far  = 9 + (1 - wet) * 9    // wet→9, dry→18
    scene.fog.near += (near - scene.fog.near) * 0.04
    scene.fog.far  += (far  - scene.fog.far)  * 0.04

    const fogTarget = ts < -0.3
      ? new THREE.Color('#C8D8EC')
      : ts >  0.5
      ? new THREE.Color('#EDE8DF')
      : new THREE.Color('#EDF2ED')
    scene.fog.color.lerp(fogTarget, 0.04)
  })

  const warmth = Math.max(0, Math.min(1, (temp - 18) / 20))
  const ambCol = new THREE.Color(0.96+warmth*0.04, 0.97-warmth*0.03, 1.00-warmth*0.10)
  const bgCol  = ts < -0.3 ? '#E0EAF5' : ts > 0.6 ? '#F5EDE5' : '#EDF2ED'

  return (
    <>
      <color attach="background" args={[bgCol]} />
      <fog attach="fog" color="#EDF2ED" near={5} far={14} />

      <ambientLight color={ambCol} intensity={0.62} />
      <directionalLight position={[3,6,4]} intensity={0.7} castShadow shadow-mapSize={[1024,1024]} shadow-camera-far={14}/>
      <pointLight position={[-2,3,-1]} intensity={0.3} color="#F0F4FF"/>

      <OrbitControls target={[0,HH,0]} minDistance={1.8} maxDistance={5.5} maxPolarAngle={Math.PI*0.76} enablePan={false}/>

      <mesh position={[0,-0.022,0]} receiveShadow>
        <boxGeometry args={[3.2,0.04,2.6]}/>
        <meshStandardMaterial color="#E6E0D8" roughness={0.82}/>
      </mesh>

      <TerrariumBase />
      <TerrariumGlass />
      <Terrain soilMoisture={soil} />
      <MossPatches />
      <GrassTufts />
      <Pebbles />
      <MushroomBed stage={stage} tempStress={ts} />
      <GrowLight />
      <MiniFan active={fanOn} />
      <WaterPump active={pumpOn} />
      <HeatShimmer stress={ts} />
      <FrostCrystals stress={ts} />
    </>
  )
}

// ─── export ───────────────────────────────────────────────────────────────────

export function Scene({ environment, devices, ai }) {
  return (
    <Canvas camera={{ position:[2.6,2.2,3.0], fov:40 }} shadows style={{ width:'100%', height:'100%' }}>
      <Suspense fallback={null}>
        <SceneContent environment={environment} devices={devices} ai={ai} />
      </Suspense>
    </Canvas>
  )
}
