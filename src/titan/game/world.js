import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { barkTexture, cobbleTexture, createRandom, facadeTexture, groundTexture, roofTexture, stoneTexture } from './textures.js'

export const WALL_RADIUS = 260
export const WALL_HEIGHT = 50
const PLAZA_RADIUS = 34
const FOREST_START_X = 95

// 夕方の太陽の向き（光源と空シェーダーで共有）
export const SUN_DIRECTION = new Vector3().setFromSphericalCoords(1, MathUtils.degToRad(72), MathUtils.degToRad(215))

function addSky(scene) {
  const sky = new Sky()
  sky.scale.setScalar(4500)
  const uniforms = sky.material.uniforms
  uniforms.turbidity.value = 7
  uniforms.rayleigh.value = 1.6
  uniforms.mieCoefficient.value = 0.006
  uniforms.mieDirectionalG.value = 0.85
  uniforms.sunPosition.value.copy(SUN_DIRECTION)
  // 太陽円盤の値は数万に達し、高画質（ブルーム）で使う半精度バッファがあふれて画面が白飛びする。
  // 上限を設けて、明るさの印象は保ったままにする
  const before = sky.material.fragmentShader
  sky.material.fragmentShader = before.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor, vec3( 4.0 ) ), 1.0 );')
  if (sky.material.fragmentShader === before) console.warn('Sky shader patch did not apply')
  scene.add(sky)
  // 地平線付近の色に合わせたかすみ
  scene.fog = new FogExp2(new Color('#c7b89e'), 0.0042)
}

function addLights(scene, quality) {
  scene.add(new HemisphereLight('#c4d6ff', '#6b5a3c', 1.1))
  const sun = new DirectionalLight('#ffd9a6', 2.6)
  sun.position.copy(SUN_DIRECTION).multiplyScalar(150)
  if (quality.shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
    const cam = sun.shadow.camera
    cam.left = -70
    cam.right = 70
    cam.top = 70
    cam.bottom = -70
    cam.near = 1
    cam.far = 400
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.6
  }
  scene.add(sun)
  scene.add(sun.target)
  return sun
}

function addGround(scene) {
  const ground = new Mesh(
    new PlaneGeometry(1400, 1400),
    new MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const plaza = new Mesh(
    new CircleGeometry(PLAZA_RADIUS, 48),
    new MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 }),
  )
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.03
  plaza.receiveShadow = true
  scene.add(plaza)
}

function addWall(scene, targets) {
  const material = new MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, side: DoubleSide })
  const wall = new Mesh(new CylinderGeometry(WALL_RADIUS, WALL_RADIUS + 6, WALL_HEIGHT, 96, 1, true), material)
  wall.position.y = WALL_HEIGHT / 2
  wall.receiveShadow = true
  scene.add(wall)
  // 壁の上の通路
  const top = new Mesh(
    new CylinderGeometry(WALL_RADIUS + 7, WALL_RADIUS + 7, 1.5, 96, 1, true),
    new MeshStandardMaterial({ color: '#8b8478', roughness: 1, side: DoubleSide }),
  )
  top.position.y = WALL_HEIGHT + 0.7
  scene.add(top)
  targets.push(wall)
}

// 城壁の外に見える山並み（遠景）。半球の頂点をずらして岩山らしい凹凸を付ける
function addMountains(scene) {
  const random = createRandom(97)
  const geometry = new IcosahedronGeometry(1, 3)
  const position = geometry.attributes.position
  const v = new Vector3()
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i)
    const bump = 1 + Math.sin(v.x * 5.1 + v.z * 3.7) * 0.08 + Math.sin(v.y * 7.3 + v.x * 2.1) * 0.06 + (random() - 0.5) * 0.08
    v.multiplyScalar(bump)
    if (v.y < 0) v.y *= 0.2
    position.setXYZ(i, v.x, v.y, v.z)
  }
  geometry.computeVertexNormals()
  const material = new MeshStandardMaterial({ color: '#7a8790', roughness: 1, flatShading: true })
  const count = 34
  const mesh = new InstancedMesh(geometry, material, count)
  const m = new Matrix4()
  const q = new Quaternion()
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + random() * 0.12
    const distance = 560 + random() * 180
    const height = 80 + random() * 150
    const radius = 130 + random() * 110
    q.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI)
    m.compose(new Vector3(Math.cos(angle) * distance, -10, Math.sin(angle) * distance), q, new Vector3(radius, height, radius * 0.8))
    mesh.setMatrixAt(i, m)
  }
  scene.add(mesh)
}

function addTown(scene, targets, colliders) {
  const random = createRandom(7)
  const spots = []
  const step = 23
  for (let gx = -WALL_RADIUS; gx <= WALL_RADIUS; gx += step) {
    for (let gz = -WALL_RADIUS; gz <= WALL_RADIUS; gz += step) {
      const x = gx + (random() - 0.5) * 4
      const z = gz + (random() - 0.5) * 4
      const r = Math.hypot(x, z)
      if (r < PLAZA_RADIUS + 10 || r > WALL_RADIUS - 22) continue
      if (x > FOREST_START_X) continue
      if (random() < 0.12) continue // ところどころ空き地を作る
      spots.push([x, z])
    }
  }

  const facade = facadeTexture()
  const bodyMaterial = new MeshStandardMaterial({ map: facade, roughness: 0.9 })
  // 箱の拡大率に合わせて UV を伸ばし、窓の大きさを建物の大きさによらず一定にする（1 タイル = 12m）
  bodyMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 boxScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 faceNormal = abs(normal);
        vec2 faceSize = faceNormal.x > 0.5 ? boxScale.zy : (faceNormal.z > 0.5 ? boxScale.xy : boxScale.xz);
        vMapUv *= faceSize / 12.0;
      #endif`,
    )
  }
  const roofMaterial = new MeshStandardMaterial({ map: roofTexture(), roughness: 0.85 })
  const bodies = new InstancedMesh(new BoxGeometry(1, 1, 1), bodyMaterial, spots.length)
  const roofGeometry = new ConeGeometry(Math.SQRT1_2, 1, 4, 1)
  roofGeometry.rotateY(Math.PI / 4)
  const roofs = new InstancedMesh(roofGeometry, roofMaterial, spots.length)

  const dummy = new Object3D()
  const tints = ['#fff7ea', '#f1e2c6', '#e6e0d6', '#f6d9c0', '#dcd4c2']
  const roofTints = ['#ffffff', '#c98b6b', '#9a8f86', '#d6a47f']
  const color = new Color()
  spots.forEach(([x, z], i) => {
    const width = 9 + random() * 7
    const depth = 9 + random() * 7
    // 中心に近いほど高い建物
    const height = 8 + random() * 10 + Math.max(0, 1 - Math.hypot(x, z) / 200) * 10
    dummy.position.set(x, height / 2, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(width, height, depth)
    dummy.updateMatrix()
    bodies.setMatrixAt(i, dummy.matrix)
    bodies.setColorAt(i, color.set(tints[Math.floor(random() * tints.length)]))

    const roofHeight = 4 + random() * 4
    dummy.position.set(x, height + roofHeight / 2, z)
    dummy.scale.set(width + 1.2, roofHeight, depth + 1.2)
    dummy.updateMatrix()
    roofs.setMatrixAt(i, dummy.matrix)
    roofs.setColorAt(i, color.set(roofTints[Math.floor(random() * roofTints.length)]))

    colliders.boxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, height: height + roofHeight * 0.5 })
  })
  for (const mesh of [bodies, roofs]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    scene.add(mesh)
    targets.push(mesh)
  }

  // 広場の時計塔（ランドマーク）
  const tower = new Mesh(new BoxGeometry(7, 34, 7), new MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 }))
  tower.material.map.repeat.set(1, 3)
  tower.position.set(0, 17, 0)
  tower.castShadow = true
  tower.receiveShadow = true
  scene.add(tower)
  targets.push(tower)
  const spire = new Mesh(new ConeGeometry(5.6, 12, 4), roofMaterial)
  spire.rotation.y = Math.PI / 4
  spire.position.set(0, 40, 0)
  spire.castShadow = true
  scene.add(spire)
  targets.push(spire)
  colliders.boxes.push({ minX: -3.5, maxX: 3.5, minZ: -3.5, maxZ: 3.5, height: 46 })
}

function addForest(scene, targets, colliders) {
  const random = createRandom(19)
  const trees = []
  let attempts = 0
  while (trees.length < 46 && attempts < 2000) {
    attempts += 1
    const x = FOREST_START_X + 10 + random() * (WALL_RADIUS - FOREST_START_X - 20)
    const z = (random() - 0.5) * 2 * (WALL_RADIUS - 20)
    if (Math.hypot(x, z) > WALL_RADIUS - 18) continue
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 16)) continue
    trees.push({ x, z, radius: 2 + random() * 1.6, height: 48 + random() * 26 })
  }

  const trunks = new InstancedMesh(
    new CylinderGeometry(0.75, 1, 1, 12, 1),
    new MeshStandardMaterial({ map: barkTexture(), roughness: 1 }),
    trees.length,
  )
  const leafCount = trees.length * 6
  const leaves = new InstancedMesh(
    new IcosahedronGeometry(1, 1),
    new MeshStandardMaterial({ color: '#4f6b34', roughness: 0.95, flatShading: true }),
    leafCount,
  )
  const dummy = new Object3D()
  const color = new Color()
  let leafIndex = 0
  trees.forEach((tree, i) => {
    dummy.position.set(tree.x, tree.height / 2, tree.z)
    dummy.rotation.set(0, random() * Math.PI, 0)
    dummy.scale.set(tree.radius, tree.height, tree.radius)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    for (let j = 0; j < 6; j += 1) {
      const angle = random() * Math.PI * 2
      const spread = 3 + random() * 7
      const size = 7 + random() * 6
      dummy.position.set(
        tree.x + Math.cos(angle) * spread,
        tree.height * (0.72 + random() * 0.3),
        tree.z + Math.sin(angle) * spread,
      )
      dummy.rotation.set(random(), random(), random())
      dummy.scale.set(size, size * 0.7, size)
      dummy.updateMatrix()
      leaves.setMatrixAt(leafIndex, dummy.matrix)
      leaves.setColorAt(leafIndex, color.setHSL(0.24 + random() * 0.06, 0.38, 0.28 + random() * 0.1))
      leafIndex += 1
    }
    colliders.cylinders.push({ x: tree.x, z: tree.z, radius: tree.radius, height: tree.height })
  })
  for (const mesh of [trunks, leaves]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    scene.add(mesh)
    targets.push(mesh)
  }
}

export function buildWorld(scene, quality) {
  const targets = [] // ワイヤーを刺せるメッシュ
  const colliders = { boxes: [], cylinders: [] }
  addSky(scene)
  const sun = addLights(scene, quality)
  addGround(scene)
  addMountains(scene)
  addWall(scene, targets)
  addTown(scene, targets, colliders)
  addForest(scene, targets, colliders)
  return { targets, colliders, sun }
}

// 球（中心 position・半径 radius）を建物・木・城壁から押し出す。
// 戻り値: 0 = 接触なし、1 = 側面に接触、2 = 上面に乗った
const pushNormal = new Vector3()
export function resolveCollisions(position, velocity, radius, colliders) {
  let touched = 0
  for (const box of colliders.boxes) {
    if (position.y - radius > box.height) continue
    const minX = box.minX - radius
    const maxX = box.maxX + radius
    const minZ = box.minZ - radius
    const maxZ = box.maxZ + radius
    if (position.x <= minX || position.x >= maxX || position.z <= minZ || position.z >= maxZ) continue
    // 最も浅い方向へ押し出す（上面も候補）
    const candidates = [
      [position.x - minX, -1, 0, 0],
      [maxX - position.x, 1, 0, 0],
      [position.z - minZ, 0, 0, -1],
      [maxZ - position.z, 0, 0, 1],
      [box.height + radius - position.y, 0, 1, 0],
    ]
    candidates.sort((a, b) => a[0] - b[0])
    const [depth, nx, ny, nz] = candidates[0]
    pushNormal.set(nx, ny, nz)
    position.addScaledVector(pushNormal, depth)
    const into = velocity.dot(pushNormal)
    if (into < 0) velocity.addScaledVector(pushNormal, -into)
    touched = Math.max(touched, ny === 1 ? 2 : 1)
  }
  for (const c of colliders.cylinders) {
    if (position.y > c.height) continue
    const dx = position.x - c.x
    const dz = position.z - c.z
    const distance = Math.hypot(dx, dz)
    const min = c.radius + radius
    if (distance >= min || distance === 0) continue
    pushNormal.set(dx / distance, 0, dz / distance)
    position.addScaledVector(pushNormal, min - distance)
    const into = velocity.dot(pushNormal)
    if (into < 0) velocity.addScaledVector(pushNormal, -into)
    touched = Math.max(touched, 1)
  }
  // 城壁（内側に閉じ込める）
  const r = Math.hypot(position.x, position.z)
  const limit = WALL_RADIUS - radius - 0.5
  if (r > limit && position.y < WALL_HEIGHT) {
    pushNormal.set(-position.x / r, 0, -position.z / r)
    position.x *= limit / r
    position.z *= limit / r
    const into = velocity.dot(pushNormal)
    if (into < 0) velocity.addScaledVector(pushNormal, -into)
    touched = Math.max(touched, 1)
  }
  return touched
}
