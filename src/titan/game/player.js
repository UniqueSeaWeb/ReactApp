import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { WALL_HEIGHT, WALL_RADIUS, resolveCollisions } from './world.js'

export const PLAYER_RADIUS = 0.5
const GRAVITY = 21
const RUN_SPEED = 11
const AIR_CONTROL = 13
const REEL_PULL = 30
const REEL_SPEED = 16
const GAS_THRUST = 30
const MAX_SPEED = 62
export const HOOK_RANGE = 95

const UP = new Vector3(0, 1, 0)
const tmp = new Vector3()
const tmp2 = new Vector3()
const cableQuat = new Quaternion()

function makeCable(scene) {
  const mesh = new Mesh(
    new CylinderGeometry(0.035, 0.035, 1, 5, 1, true),
    new MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.4, metalness: 0.6 }),
  )
  mesh.visible = false
  scene.add(mesh)
  return mesh
}

export class Player {
  constructor(scene) {
    this.position = new Vector3(0, 2, 24)
    this.velocity = new Vector3()
    this.onGround = false
    this.gas = 100
    this.gasCooldown = 0
    this.hp = 3
    this.invulnerable = 0
    this.boosting = false
    this.faceYaw = Math.PI
    // 左右 2 本のワイヤー。アンカー位置は巨人に刺さった場合、巨人と一緒に動く
    this.hooks = [-1, 1].map((side) => ({ side, active: false, anchor: new Vector3(), length: 0, object: null, local: new Vector3(), cable: makeCable(scene), fire: 0 }))

    this.model = this.buildModel()
    scene.add(this.model)
  }

  buildModel() {
    const group = new Group()
    const cloak = new MeshStandardMaterial({ color: '#2f4a46', roughness: 0.85 })
    const cloth = new MeshStandardMaterial({ color: '#cdbf9f', roughness: 0.9 })
    const leather = new MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.7 })
    const metal = new MeshStandardMaterial({ color: '#c9d0d8', roughness: 0.25, metalness: 0.9 })
    const skin = new MeshStandardMaterial({ color: '#e0b394', roughness: 0.7 })

    const add = (geometry, material, x, y, z) => {
      const mesh = new Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      group.add(mesh)
      return mesh
    }
    add(new CapsuleGeometry(0.28, 0.6, 4, 10), cloth, 0, 0.05, 0)
    const cape = add(new BoxGeometry(0.62, 0.9, 0.06), cloak, 0, 0.05, -0.3)
    cape.rotation.x = 0.25
    add(new SphereGeometry(0.2, 14, 10), skin, 0, 0.62, 0)
    add(new SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), leather, 0, 0.66, -0.02)
    // 腰の装置（ガスボンベと刃の鞘）
    for (const side of [-1, 1]) {
      const tank = add(new CylinderGeometry(0.09, 0.09, 0.55, 10), metal, side * 0.3, -0.15, -0.15)
      tank.rotation.x = Math.PI / 2
      const blade = add(new BoxGeometry(0.03, 0.05, 0.9), metal, side * 0.38, 0.02, 0.35)
      blade.rotation.x = -0.2
    }
    add(new CapsuleGeometry(0.11, 0.5, 4, 8), leather, -0.13, -0.6, 0)
    add(new CapsuleGeometry(0.11, 0.5, 4, 8), leather, 0.13, -0.6, 0)
    return group
  }

  // ワイヤーを射出する（hit: { point, object }）
  attach(hit) {
    let i = 0
    for (const hook of this.hooks) {
      // 2 本を少し左右にずらして刺す
      tmp.set(hook.side * 0.6, 0, 0)
      hook.anchor.copy(hit.point).add(i === 0 ? tmp : tmp.negate())
      hook.object = hit.titan ? hit.object : null
      if (hook.object) {
        hook.object.updateWorldMatrix(true, false)
        hook.local.copy(hook.anchor)
        hook.object.worldToLocal(hook.local)
      }
      hook.length = hook.anchor.distanceTo(this.position)
      hook.active = true
      hook.fire = 0
      i += 1
    }
  }

  detach() {
    for (const hook of this.hooks) {
      hook.active = false
      hook.object = null
    }
  }

  get hooked() {
    return this.hooks[0].active
  }

  update(dt, input, camera, colliders) {
    const acc = tmp.set(0, -GRAVITY, 0)

    // 入力方向（カメラの向き基準）
    const forward = tmp2.set(0, 0, -1).applyQuaternion(camera.quaternion)
    forward.y = 0
    forward.normalize()
    const right = new Vector3().crossVectors(forward, UP)
    const move = new Vector3().addScaledVector(forward, input.moveY).addScaledVector(right, input.moveX)
    const moveAmount = Math.min(1, move.length())
    if (moveAmount > 0.01) move.normalize()

    if (this.hooked) {
      for (const hook of this.hooks) {
        if (hook.object) {
          hook.anchor.copy(hook.local)
          hook.object.localToWorld(hook.anchor)
          // 倒れた巨人からは外れる
          if (hook.object.userData.titan && !hook.object.userData.titan.alive) this.detach()
        }
      }
    }

    if (this.hooked) {
      const hook = this.hooks[0]
      const anchor = new Vector3().addVectors(this.hooks[0].anchor, this.hooks[1].anchor).multiplyScalar(0.5)
      const toAnchor = anchor.clone().sub(this.position)
      const distance = toAnchor.length()
      toAnchor.divideScalar(Math.max(distance, 0.001))
      // 巻き取り
      hook.length = Math.max(2.5, Math.min(hook.length, distance) - REEL_SPEED * dt)
      this.hooks[1].length = hook.length
      acc.addScaledVector(toAnchor, REEL_PULL)
      acc.addScaledVector(move, AIR_CONTROL * moveAmount)
      // ロープの長さを超えたら引き戻す（振り子運動）
      if (distance > hook.length) {
        this.position.addScaledVector(toAnchor, distance - hook.length)
        const radial = this.velocity.dot(toAnchor)
        if (radial < 0) this.velocity.addScaledVector(toAnchor, -radial)
      }
      // アンカーに着いたら自動で外す
      if (distance < 2.8) this.detach()
    } else if (!this.onGround) {
      acc.addScaledVector(move, AIR_CONTROL * moveAmount)
    }

    // ガス噴射：カメラの向きへ加速し、重力も少し打ち消す
    this.boosting = false
    if (input.gas && this.gas > 0) {
      const dir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      dir.y = Math.max(dir.y, -0.2) + 0.15
      dir.normalize()
      acc.addScaledVector(dir, GAS_THRUST)
      acc.y += GRAVITY * 0.35
      this.gas = Math.max(0, this.gas - 24 * dt)
      this.gasCooldown = 0.8
      this.boosting = true
    } else {
      this.gasCooldown -= dt
      if (this.gasCooldown <= 0) this.gas = Math.min(100, this.gas + (this.onGround ? 30 : 9) * dt)
    }

    this.velocity.addScaledVector(acc, dt)

    if (this.onGround && !this.hooked && !this.boosting) {
      // 地上では走る
      const target = move.multiplyScalar(RUN_SPEED * moveAmount)
      const k = 1 - Math.exp(-10 * dt)
      this.velocity.x += (target.x - this.velocity.x) * k
      this.velocity.z += (target.z - this.velocity.z) * k
    } else {
      this.velocity.multiplyScalar(Math.exp(-0.12 * dt))
    }
    if (this.velocity.length() > MAX_SPEED) this.velocity.setLength(MAX_SPEED)

    this.position.addScaledVector(this.velocity, dt)

    // 地面
    this.onGround = false
    if (this.position.y < PLAYER_RADIUS + 0.75) {
      this.position.y = PLAYER_RADIUS + 0.75
      if (this.velocity.y < 0) this.velocity.y = 0
      this.onGround = true
    }
    // 屋根の上に乗ったら地上と同じく走れる
    if (resolveCollisions(this.position, this.velocity, PLAYER_RADIUS, colliders) === 2) this.onGround = true
    // 城壁の上を越えて外へ出すぎないようにする
    const r = Math.hypot(this.position.x, this.position.z)
    if (r > WALL_RADIUS + 12 && this.position.y < WALL_HEIGHT + 30) {
      this.position.x *= (WALL_RADIUS + 12) / r
      this.position.z *= (WALL_RADIUS + 12) / r
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt)
    this.updateModel(dt)
    this.updateCables(dt)
  }

  updateModel(dt) {
    this.model.position.copy(this.position)
    const speed = this.velocity.length()
    const yaw = speed > 1 ? Math.atan2(this.velocity.x, this.velocity.z) : this.faceYaw
    const diff = Math.atan2(Math.sin(yaw - this.model.rotation.y), Math.cos(yaw - this.model.rotation.y))
    this.model.rotation.y += diff * Math.min(1, dt * 10)
    // 速く飛ぶほど前傾する
    const lean = this.onGround ? 0 : MathUtils.clamp(speed / 40, 0, 1) * 1.1
    this.model.rotation.x += (lean - this.model.rotation.x) * Math.min(1, dt * 6)
    // 無敵時間は点滅
    this.model.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 12) % 2 === 0
  }

  updateCables(dt) {
    for (const hook of this.hooks) {
      const cable = hook.cable
      if (!hook.active) {
        cable.visible = false
        continue
      }
      hook.fire = Math.min(1, hook.fire + dt * 9)
      const start = tmp.set(hook.side * 0.3, -0.1, 0).applyQuaternion(this.model.quaternion).add(this.position)
      const end = tmp2.copy(hook.anchor).sub(start).multiplyScalar(hook.fire).add(start)
      const length = start.distanceTo(end)
      cable.visible = true
      cable.position.copy(start).add(end).multiplyScalar(0.5)
      cable.scale.set(1, length, 1)
      cableQuat.setFromUnitVectors(UP, end.sub(start).normalize())
      cable.quaternion.copy(cableQuat)
    }
  }

  // 背中側のガス噴射口の位置と、噴射の向き
  nozzle(target) {
    return target.set(0, -0.1, -0.35).applyQuaternion(this.model.quaternion).add(this.position)
  }
}
