import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'

// 巨人は高さ 10 の基本モデルを作り、全体を拡大縮小して大きさを変える
const SKIN_TONES = ['#d9a58a', '#c98f74', '#e2b59a', '#b97f66', '#d6a08e']
const HAIR_TONES = ['#2b211b', '#4a3626', '#1b1a18', '#6b5038']

const geometries = {
  thigh: new CapsuleGeometry(0.46, 1.6, 6, 12),
  shin: new CapsuleGeometry(0.38, 1.5, 6, 12),
  foot: new BoxGeometry(0.7, 0.35, 1.2),
  torso: new CapsuleGeometry(1, 1.6, 8, 16),
  belly: new SphereGeometry(1, 20, 14),
  neck: new CylinderGeometry(0.42, 0.5, 0.8, 12),
  head: new SphereGeometry(0.88, 24, 18),
  hair: new SphereGeometry(0.93, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  eye: new SphereGeometry(0.13, 10, 8),
  mouth: new TorusGeometry(0.34, 0.06, 6, 16, Math.PI),
  upperArm: new CapsuleGeometry(0.33, 1.4, 6, 12),
  foreArm: new CapsuleGeometry(0.29, 1.3, 6, 12),
  hand: new SphereGeometry(0.42, 14, 10),
  nape: new RingGeometry(0.28, 0.42, 24),
}
const eyeMaterial = new MeshStandardMaterial({ color: '#1a1410', roughness: 0.3 })
const mouthMaterial = new MeshStandardMaterial({ color: '#4a1f1a', roughness: 0.6 })
const napeMaterial = new MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })

function part(geometry, material, x, y, z, parent) {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function limb(parent, x, y) {
  const pivot = new Group()
  pivot.position.set(x, y, 0)
  parent.add(pivot)
  return pivot
}

const toPlayer = new Vector3()
const handWorld = new Vector3()

export class Titan {
  constructor(scene, random, height) {
    this.height = height
    this.scale = height / 10
    this.state = 'walk'
    this.phase = random() * Math.PI * 2
    this.speed = (2.6 + random() * 1.8) * Math.sqrt(this.scale)
    this.attackTimer = 0
    this.attackCooldown = 1 + random() * 2
    this.deadTimer = 0
    this.hitDone = false
    this.alive = true
    this.removed = false

    const skin = new MeshStandardMaterial({
      color: SKIN_TONES[Math.floor(random() * SKIN_TONES.length)],
      roughness: 0.72,
    })
    const hairMaterial = new MeshStandardMaterial({ color: HAIR_TONES[Math.floor(random() * HAIR_TONES.length)], roughness: 0.9 })
    this.materials = [skin, hairMaterial]

    const root = new Group()
    this.root = root
    const body = new Group()
    root.add(body)
    this.body = body

    // 脚
    this.legs = [-0.6, 0.6].map((x) => {
      const hip = limb(body, x, 4.7)
      part(geometries.thigh, skin, 0, -1.15, 0, hip)
      const knee = limb(hip, 0, -2.3)
      part(geometries.shin, skin, 0, -1.05, 0, knee)
      part(geometries.foot, skin, 0, -2.2, 0.25, knee)
      return { hip, knee }
    })

    // 胴体
    const torso = part(geometries.torso, skin, 0, 6.1, 0, body)
    torso.scale.set(1.12, 1, 0.78)
    const belly = part(geometries.belly, skin, 0, 5.1, 0.12, body)
    belly.scale.set(0.98, 0.75, 0.82)
    part(geometries.neck, skin, 0, 7.95, -0.05, body)

    // 頭
    const head = new Group()
    head.position.set(0, 8.75, 0)
    body.add(head)
    this.head = head
    part(geometries.head, skin, 0, 0, 0, head).scale.set(1, 1.08, 1)
    if (random() < 0.75) part(geometries.hair, hairMaterial, 0, 0.08, -0.04, head)
    part(geometries.eye, eyeMaterial, -0.3, 0.12, 0.78, head)
    part(geometries.eye, eyeMaterial, 0.3, 0.12, 0.78, head)
    const mouth = part(geometries.mouth, mouthMaterial, 0, -0.32, 0.74, head)
    mouth.rotation.z = Math.PI
    mouth.scale.set(1.2, 0.6, 1)

    // 腕
    this.arms = [-1, 1].map((side) => {
      const shoulder = limb(body, side * 1.38, 7.35)
      part(geometries.upperArm, skin, 0, -1.0, 0, shoulder)
      const elbow = limb(shoulder, 0, -2.0)
      part(geometries.foreArm, skin, 0, -0.95, 0, elbow)
      const hand = part(geometries.hand, skin, 0, -1.95, 0, elbow)
      return { shoulder, elbow, hand, side }
    })

    // うなじ（弱点）の目印。近づくと光る
    this.napeMarker = new Mesh(geometries.nape, napeMaterial.clone())
    this.napeMarker.position.set(0, 8.05, -0.62)
    this.napeMarker.rotation.y = Math.PI
    body.add(this.napeMarker)

    root.scale.setScalar(this.scale)
    root.traverse((child) => {
      if (child.isMesh) child.userData.titan = this
    })
    scene.add(root)
    this.scene = scene
  }

  get position() {
    return this.root.position
  }

  // うなじのワールド座標
  napePosition(target) {
    return this.napeMarker.getWorldPosition(target)
  }

  meshes() {
    const list = []
    this.root.traverse((child) => {
      if (child.isMesh && child !== this.napeMarker) list.push(child)
    })
    return list
  }

  update(dt, player, colliders, resolveCollisions, onHit) {
    if (!this.alive) {
      this.updateDeath(dt)
      return
    }
    toPlayer.copy(player.position).sub(this.root.position)
    toPlayer.y = 0
    const distance = toPlayer.length()

    // 体の向きをプレイヤーへ
    const targetYaw = Math.atan2(toPlayer.x, toPlayer.z)
    let diff = targetYaw - this.root.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.root.rotation.y += diff * Math.min(1, dt * (this.state === 'attack' ? 1.2 : 2.2))

    const reach = this.height * 0.62
    this.attackCooldown -= dt

    if (this.state === 'walk') {
      if (distance > reach * 0.7) {
        const step = Math.min(this.speed * dt, distance - reach * 0.7)
        this.root.position.addScaledVector(toPlayer.normalize(), step)
      }
      this.phase += dt * this.speed * 0.9 / this.scale
      if (distance < reach && player.position.y < this.height * 1.15 && this.attackCooldown <= 0) {
        this.state = 'attack'
        this.attackTimer = 0
        this.hitDone = false
      }
    } else if (this.state === 'attack') {
      this.attackTimer += dt
      if (!this.hitDone && this.attackTimer > 0.55 && this.attackTimer < 0.95) {
        const hand = this.arms[1].hand.getWorldPosition(handWorld)
        if (hand.distanceTo(player.position) < this.height * 0.2 + 1.2) {
          this.hitDone = true
          onHit(this)
        }
      }
      if (this.attackTimer > 1.5) {
        this.state = 'walk'
        this.attackCooldown = 1.6 + Math.random() * 1.5
      }
    }

    // 建物の中に入り込まないよう押し出す
    const radius = this.height * 0.16
    const center = this.root.position
    const saveY = center.y
    center.y = 1
    resolveCollisions(center, toPlayer.set(0, 0, 0), radius, colliders)
    center.y = saveY

    this.animate(dt)

    // 近くにいるときだけ、うなじの目印を光らせる
    const napeDistance = this.napePosition(handWorld).distanceTo(player.position)
    const target = napeDistance < 30 ? MathUtils.clamp(1 - napeDistance / 30, 0, 1) * 0.9 + 0.1 : 0
    this.napeMarker.material.opacity += (target - this.napeMarker.material.opacity) * Math.min(1, dt * 6)
  }

  animate() {
    const walking = this.state === 'walk'
    const swing = walking ? Math.sin(this.phase) : 0
    const [left, right] = this.legs
    left.hip.rotation.x = swing * 0.5
    right.hip.rotation.x = -swing * 0.5
    left.knee.rotation.x = Math.max(0, -swing) * 0.7
    right.knee.rotation.x = Math.max(0, swing) * 0.7
    this.body.position.y = walking ? Math.abs(Math.cos(this.phase)) * 0.18 : 0
    this.body.rotation.z = swing * 0.04
    this.head.rotation.y = Math.sin(this.phase * 0.5) * 0.15

    const [leftArm, rightArm] = this.arms
    leftArm.shoulder.rotation.x = -swing * 0.4
    leftArm.shoulder.rotation.z = -0.12
    leftArm.elbow.rotation.x = -0.3
    if (this.state === 'attack') {
      // 右腕を振り上げてつかみにくる
      const t = this.attackTimer
      const raise = t < 0.6 ? MathUtils.smoothstep(t, 0, 0.6) : 1 - MathUtils.smoothstep(t, 0.9, 1.5)
      rightArm.shoulder.rotation.x = -2.3 * raise
      rightArm.shoulder.rotation.z = 0.25 * raise
      rightArm.elbow.rotation.x = -0.5 * (1 - raise)
      this.body.rotation.x = 0.15 * raise
    } else {
      rightArm.shoulder.rotation.x = swing * 0.4
      rightArm.shoulder.rotation.z = 0.12
      rightArm.elbow.rotation.x = -0.3
      this.body.rotation.x = 0
    }
  }

  kill() {
    this.alive = false
    this.state = 'dead'
    this.deadTimer = 0
    this.napeMarker.material.opacity = 0
  }

  updateDeath(dt) {
    this.deadTimer += dt
    const t = this.deadTimer
    // 前のめりに倒れ、そのあと地面に沈みながら消える
    this.root.rotation.x = MathUtils.smoothstep(t, 0, 1.4) * 1.45
    if (t > 1.6) this.root.position.y -= dt * this.height * 0.12
    if (t > 5) {
      this.scene.remove(this.root)
      for (const material of this.materials) material.dispose()
      this.napeMarker.material.dispose()
      this.removed = true
    }
  }
}
