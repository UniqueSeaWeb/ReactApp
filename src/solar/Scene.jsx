import { Line, OrbitControls, Stars } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, MathUtils, Vector3 } from 'three'
import { PLANETS, SUN } from './bodies.js'
import { createPlanetTexture } from './textures.js'

const OVERVIEW_DISTANCE = 132
const ORIGIN = new Vector3()
// ラベル位置の計算に使う作業用ベクトル（毎フレームの生成を避ける）
const labelPosition = new Vector3()
const labelEdge = new Vector3()
const LABEL_GAP_PX = 14

function orbitPoints(distance) {
  const points = []
  for (let i = 0; i <= 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2
    points.push([Math.cos(angle) * distance, 0, Math.sin(angle) * distance])
  }
  return points
}

function Sun({ onSelect }) {
  return (
    <group>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(SUN.id)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[SUN.radius, 48, 48]} />
        <meshBasicMaterial color={SUN.color} toneMapped={false} />
      </mesh>
      {/* 光のにじみ */}
      <mesh scale={1.35}>
        <sphereGeometry args={[SUN.radius, 32, 32]} />
        <meshBasicMaterial color="#ff9a2e" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <pointLight intensity={2.6} decay={0} color="#fff1dc" />
    </group>
  )
}

function Planet({ planet, simRef, registerRef, onSelect }) {
  const orbitRef = useRef(null)
  const spinRef = useRef(null)
  const texture = useMemo(() => createPlanetTexture(planet.id, planet.texture), [planet])

  useFrame(() => {
    const angle = planet.phase + (simRef.current.days / planet.periodDays) * Math.PI * 2
    orbitRef.current.position.set(Math.cos(angle) * planet.distance, 0, -Math.sin(angle) * planet.distance)
    // 見た目の自転（実際の周期ではなく、模様が流れて見える程度）
    spinRef.current.rotation.y = simRef.current.days * 0.6
  })

  return (
    <group
      ref={(node) => {
        orbitRef.current = node
        registerRef(planet.id, node)
      }}
    >
      <group rotation={[0, 0, MathUtils.degToRad(planet.tiltDeg)]}>
        <mesh
          ref={spinRef}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(planet.id)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <sphereGeometry args={[planet.radius, 48, 48]} />
          <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
        </mesh>
        {planet.ring && (
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[planet.radius * planet.ring.inner, planet.radius * planet.ring.outer, 96]} />
            <meshStandardMaterial
              color={planet.ring.color}
              side={DoubleSide}
              transparent
              opacity={0.7}
              roughness={1}
            />
          </mesh>
        )}
        {/* 小さな惑星もクリックしやすいよう、見えない当たり判定を広げる */}
        <mesh
          visible={false}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(planet.id)
          }}
        >
          <sphereGeometry args={[Math.max(planet.radius * 1.8, 1.6), 12, 12]} />
        </mesh>
      </group>
    </group>
  )
}

const TRANSITION_SECONDS = 1.2
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function CameraRig({ selectedId, bodyRefs, transitionRef }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const size = useThree((state) => state.size)
  const vectors = useMemo(
    () => ({ target: new Vector3(), from: new Vector3(), desired: new Vector3(), delta: new Vector3(), offset: new Vector3() }),
    [],
  )
  const motion = useRef({ running: false, progress: 0, fromDistance: 0, selectedId: null })

  useFrame((_, dt) => {
    if (!controls) return
    const { target, from, desired, delta, offset } = vectors
    const node = selectedId && selectedId !== SUN.id ? bodyRefs.current.get(selectedId) : null
    if (node) node.getWorldPosition(target)
    else target.copy(ORIGIN)

    // 選択が変わったら（移動の途中でも）、そのときの注視点と距離から移動を始め直す
    const m = motion.current
    if (transitionRef.current && (!m.running || m.selectedId !== selectedId)) {
      m.running = true
      m.selectedId = selectedId
      m.progress = 0
      from.copy(controls.target)
      m.fromDistance = camera.position.distanceTo(controls.target)
    }

    if (m.running) {
      // 時間で進めるので、惑星が速く動いていても 1.2 秒で必ず追いつく
      m.progress = prefersReducedMotion() ? 1 : Math.min(m.progress + dt / TRANSITION_SECONDS, 1)
      const eased = easeInOutCubic(m.progress)
      desired.copy(from).lerp(target, eased)
      delta.copy(desired).sub(controls.target)
      controls.target.add(delta)
      camera.position.add(delta)

      const body = [SUN, ...PLANETS].find((b) => b.id === selectedId)
      // 縦長の画面では横幅が足りないので、少し引いて全体を収める
      const portrait = size.width < size.height ? 1.5 : 1
      const want = (body ? body.radius * (body.ring ? 9 : 7) + 3 : OVERVIEW_DISTANCE) * portrait
      offset.copy(camera.position).sub(controls.target)
      offset.setLength(m.fromDistance + (want - m.fromDistance) * eased)
      camera.position.copy(controls.target).add(offset)

      if (m.progress >= 1) {
        m.running = false
        transitionRef.current = false
      }
    } else {
      // 到着後は対象にぴったり追従する（ユーザーが回した角度と距離は保つ）
      delta.copy(target).sub(controls.target)
      controls.target.add(delta)
      camera.position.add(delta)
    }
    controls.update()
  })

  return null
}

// 天体名のラベル（3D 空間の外の DOM）を、毎フレーム天体の画面上の位置へ動かす。
// drei の Html は React 19 の StrictMode で中身が消える・removeChild エラーが出るため使わない。
function LabelProjector({ bodyRefs, labelRefs }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame(() => {
    for (const body of [SUN, ...PLANETS]) {
      const element = labelRefs.current.get(body.id)
      if (!element) continue
      const node = bodyRefs.current.get(body.id)
      if (node) node.getWorldPosition(labelPosition)
      else labelPosition.copy(ORIGIN)
      // 天体の上端（カメラから見た上方向に半径分）も投影し、画面上の半径を求める
      labelEdge.copy(camera.up).applyQuaternion(camera.quaternion).multiplyScalar(body.radius).add(labelPosition)
      labelPosition.project(camera)
      labelEdge.project(camera)
      element.style.visibility = labelPosition.z > 1 ? 'hidden' : ''
      const x = ((labelPosition.x + 1) / 2) * size.width
      const centerY = ((1 - labelPosition.y) / 2) * size.height
      const edgeY = ((1 - labelEdge.y) / 2) * size.height
      const y = centerY - Math.abs(centerY - edgeY) - LABEL_GAP_PX
      element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }
  })

  return null
}

// パネルに隠れない位置に注視点が来るよう、描画範囲をずらす。
// PC は右側のパネルの分だけ左へ、スマホは下側のパネルの分だけ上へ。
function ViewOffset() {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useEffect(() => {
    const { width, height } = size
    if (width >= 768) camera.setViewOffset(width, height, 180, 0, width, height)
    else camera.setViewOffset(width, height, 0, height * 0.2, width, height)
    return () => camera.clearViewOffset()
  }, [camera, size])

  return null
}

function Clock({ simRef }) {
  useFrame((_, dt) => {
    const sim = simRef.current
    // タブ復帰時などの大きな dt で惑星が飛ばないよう上限を設ける
    if (sim.playing) sim.days += Math.min(dt, 0.1) * sim.speed
  })
  return null
}

export default function Scene({ simRef, selectedId, onSelect, showOrbits, labelRefs, transitionRef }) {
  const bodyRefs = useRef(new Map())
  const registerRef = (id, node) => {
    if (node) bodyRefs.current.set(id, node)
    else bodyRefs.current.delete(id)
  }
  const orbits = useMemo(() => PLANETS.map((planet) => orbitPoints(planet.distance)), [])

  return (
    <>
      <color attach="background" args={['#05070d']} />
      <ambientLight intensity={0.12} />
      <Stars radius={300} depth={80} count={4000} factor={5} saturation={0} fade speed={0.4} />
      <Clock simRef={simRef} />
      <ViewOffset />

      <Sun onSelect={onSelect} />

      {showOrbits &&
        PLANETS.map((planet, index) => (
          <Line
            key={planet.id}
            points={orbits[index]}
            color={selectedId === planet.id ? '#ffc56b' : '#7f8aa8'}
            lineWidth={selectedId === planet.id ? 1.6 : 1}
            transparent
            opacity={selectedId === planet.id ? 0.9 : 0.28}
          />
        ))}

      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          planet={planet}
          simRef={simRef}
          registerRef={registerRef}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={220}
        enablePan={false}
      />
      <CameraRig selectedId={selectedId} bodyRefs={bodyRefs} transitionRef={transitionRef} />
      <LabelProjector bodyRefs={bodyRefs} labelRefs={labelRefs} />
    </>
  )
}
