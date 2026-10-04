import {
  ACESFilmicToneMapping,
  Euler,
  MathUtils,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { Sound } from './audio.js'
import { Effects } from './effects.js'
import { HOOK_RANGE, Player } from './player.js'
import { createRandom } from './textures.js'
import { Titan } from './titan.js'
import { SUN_DIRECTION, buildWorld, resolveCollisions } from './world.js'

export const WAVES = [3, 4, 5, 6, 8]

export const QUALITY = {
  high: { label: '高画質', pixelRatio: 2, shadows: true, shadowMapSize: 2048, bloom: true },
  standard: { label: '標準', pixelRatio: 1.25, shadows: true, shadowMapSize: 1024, bloom: false },
}

// 照準の候補：画面中央と、その周りに少しずらした点（狙いを補助する）
const AIM_OFFSETS = [[0, 0]]
for (const radius of [0.06, 0.13]) {
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    AIM_OFFSETS.push([Math.cos(a) * radius, Math.sin(a) * radius])
  }
}

const tmp = new Vector3()
const tmp2 = new Vector3()
const ndc = new Vector2()
const euler = new Euler(0, 0, 0, 'YXZ')
const quat = new Quaternion()

export function createInput() {
  return { moveX: 0, moveY: 0, lookYaw: 0, lookPitch: 0, anchor: false, gas: false, slash: 0, touch: false, lastLook: 0 }
}

export class Game {
  constructor(canvas, { quality = 'standard', reducedMotion = false, onHud, onEvent, debug = false }) {
    this.canvas = canvas
    this.onHud = onHud
    this.onEvent = onEvent
    this.reducedMotion = reducedMotion
    this.input = createInput()
    this.sound = new Sound()
    this.quality = QUALITY[quality]
    this.running = false
    this.state = 'idle'

    const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.85
    renderer.shadowMap.enabled = this.quality.shadows
    renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer = renderer

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(72, 1, 0.1, 6000)
    this.world = buildWorld(this.scene, this.quality)
    this.player = new Player(this.scene)
    this.effects = new Effects(this.scene, renderer.getPixelRatio())
    this.raycaster = new Raycaster()
    this.titans = []
    this.random = createRandom(Date.now() % 100000)

    if (this.quality.bloom) {
      const composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(this.scene, this.camera))
      // 空全体がにじまないよう、しきい値を高くして太陽・斬撃・火花だけを光らせる
      this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.22, 0.3, 2.6)
      composer.addPass(this.bloom)
      composer.addPass(new OutputPass())
      this.composer = composer
    }

    this.yaw = 0
    this.pitch = -0.12
    this.cameraPosition = new Vector3()
    this.shake = 0
    this.timeScale = 1
    this.slowTimer = 0
    this.hudTimer = 0
    this.aimTimer = 0
    this.aim = { hit: null, nape: null }
    this.frame = this.frame.bind(this)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement)
    this.resize()
    this.reset()
    this.renderFrame()
    if (debug) window.__titanGame = this
  }

  resize() {
    const parent = this.canvas.parentElement
    const width = parent.clientWidth || 1
    const height = parent.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.composer?.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  reset() {
    for (const titan of this.titans) this.scene.remove(titan.root)
    this.titans = []
    const p = this.player
    p.position.set(0, 2, 24)
    p.velocity.set(0, 0, 0)
    p.hp = 3
    p.gas = 100
    p.invulnerable = 0
    p.detach()
    this.yaw = 0
    this.pitch = -0.12
    this.score = 0
    this.kills = 0
    this.combo = 0
    this.lastKill = -100
    this.elapsed = 0
    this.waveIndex = -1
    this.waveDelay = 0
    this.updateCamera(1)
    this.cameraPosition.copy(this.camera.position)
    this.showcaseCamera()
  }

  // タイトル画面用：街と森を見渡す構図
  showcaseCamera() {
    this.camera.position.set(-70, 38, 120)
    this.camera.lookAt(30, 18, -60)
    this.camera.fov = 60
    this.camera.updateProjectionMatrix()
  }

  start() {
    this.reset()
    this.updateCamera(1)
    this.camera.position.copy(this.cameraPosition)
    this.sound.start()
    this.state = 'playing'
    this.nextWave()
    this.resume()
  }

  resume() {
    if (this.running || this.state !== 'playing') return
    this.running = true
    this.sound.start()
    this.lastTime = performance.now()
    requestAnimationFrame(this.frame)
  }

  pause() {
    this.running = false
    this.sound.suspend()
  }

  dispose() {
    this.pause()
    this.resizeObserver.disconnect()
    this.renderer.dispose()
    if (window.__titanGame === this) delete window.__titanGame
  }

  nextWave() {
    this.waveIndex += 1
    if (this.waveIndex >= WAVES.length) {
      this.finish(true)
      return
    }
    const count = WAVES[this.waveIndex]
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * Math.PI * 2
      const distance = 95 + this.random() * 110
      // 波が進むほど大きな巨人が混じる（第 1 波 9〜12m、第 5 波は最大約 19m）
      const maxHeight = 12 + this.waveIndex * 1.8
      const titan = new Titan(this.scene, this.random, 9 + this.random() * (maxHeight - 9))
      titan.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance)
      titan.root.rotation.y = this.random() * Math.PI * 2
      this.titans.push(titan)
    }
    this.titanMeshes = null
    this.sound.wave()
    this.onEvent?.({ type: 'wave', wave: this.waveIndex + 1, total: WAVES.length, count })
  }

  finish(cleared) {
    this.state = cleared ? 'clear' : 'over'
    this.running = false
    this.sound.update(0, false)
    this.emitHud()
    this.onEvent?.({
      type: cleared ? 'clear' : 'gameover',
      score: this.score,
      kills: this.kills,
      time: this.elapsed,
      wave: Math.min(this.waveIndex + 1, WAVES.length),
    })
  }

  frame(now) {
    if (!this.running) return
    // 物理計算は 1 フレーム最大 1/20 秒に抑え、待ち時間などは実際の経過時間で数える
    const elapsed = Math.min((now - this.lastTime) / 1000, 0.25)
    this.lastTime = now
    this.update(Math.min(elapsed, 1 / 20), elapsed)
    this.renderFrame()
    if (this.running) requestAnimationFrame(this.frame)
  }

  renderFrame() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  aimTargets() {
    if (!this.titanMeshes) this.titanMeshes = this.titans.filter((t) => t.alive).flatMap((t) => t.meshes())
    return [...this.world.targets, ...this.titanMeshes]
  }

  // 画面中央（と補助の候補点）から、ワイヤーを刺せる場所を探す
  findAnchor() {
    const targets = this.aimTargets()
    for (const [x, y] of AIM_OFFSETS) {
      this.raycaster.setFromCamera(ndc.set(x, y), this.camera)
      this.raycaster.far = HOOK_RANGE + 12
      const hits = this.raycaster.intersectObjects(targets, false)
      const hit = hits.find((h) => h.point.distanceTo(this.player.position) <= HOOK_RANGE && h.point.distanceTo(this.player.position) > 3)
      if (hit) {
        return { point: hit.point.clone(), object: hit.object, titan: hit.object.userData.titan ?? null }
      }
    }
    return null
  }

  nearestNape() {
    let best = null
    for (const titan of this.titans) {
      if (!titan.alive) continue
      const distance = titan.napePosition(tmp).distanceTo(this.player.position)
      const reach = 3.4 + titan.scale * 1.3
      if (distance < reach && (!best || distance < best.distance)) best = { titan, distance }
    }
    return best
  }

  update(realDt, wallDt = realDt) {
    // 討伐の瞬間だけスローモーション
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt
      this.timeScale = this.slowTimer > 0 ? 0.3 : 1
    }
    const dt = realDt * this.timeScale
    const input = this.input
    this.elapsed += dt

    // 視点操作
    this.yaw -= input.lookYaw
    this.pitch = MathUtils.clamp(this.pitch - input.lookPitch, -1.25, 0.75)
    input.lookYaw = 0
    input.lookPitch = 0
    // スマホでは、しばらく視点を動かしていなければ進行方向へカメラを寄せる
    const speed = this.player.velocity.length()
    if (input.touch && performance.now() - input.lastLook > 900 && speed > 10 && !input.anchor) {
      const targetYaw = Math.atan2(-this.player.velocity.x, -this.player.velocity.z)
      let diff = targetYaw - this.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      this.yaw += diff * Math.min(1, realDt * 1.2)
    }

    // ワイヤー：押した瞬間に刺し、離すと外す
    if (input.anchor && !this.anchorHeld) {
      const hit = this.findAnchor()
      if (hit) {
        this.player.attach(hit)
        this.sound.hook()
      }
    }
    if (!input.anchor && this.anchorHeld) this.player.detach()
    this.anchorHeld = input.anchor

    // 止まっているときは、カメラの向きに背中を向ける
    this.player.faceYaw = this.yaw + Math.PI
    this.player.update(dt, input, this.camera, this.world.colliders)

    if (this.player.boosting) {
      const nozzle = this.player.nozzle(tmp)
      const back = tmp2.set(0, 0, 1).applyQuaternion(this.camera.quaternion)
      this.effects.emitGas(nozzle, back)
    }

    // 斬撃
    if (input.slash > 0) {
      input.slash = 0
      this.trySlash()
    }

    for (const titan of this.titans) {
      titan.update(dt, this.player, this.world.colliders, resolveCollisions, (t) => this.hurtPlayer(t))
      if (!titan.alive && !titan.removed && titan.deadTimer < 3.5) {
        titan.napePosition(tmp)
        this.effects.emitSteam(tmp, titan.scale * 2.5, 1)
      }
    }
    const before = this.titans.length
    this.titans = this.titans.filter((t) => !t.removed)
    if (this.titans.length !== before) this.titanMeshes = null

    // 全滅したら次のウェーブへ
    if (this.state === 'playing' && this.titans.every((t) => !t.alive)) {
      this.waveDelay += wallDt
      if (this.waveDelay > 2.5) {
        this.waveDelay = 0
        this.nextWave()
      }
    }

    this.effects.update(dt)
    this.updateCamera(realDt)

    // 影の範囲をプレイヤーに追従させる
    const sun = this.world.sun
    sun.target.position.copy(this.player.position)
    sun.position.copy(this.player.position).addScaledVector(SUN_DIRECTION, 150)

    this.aimTimer -= realDt
    if (this.aimTimer <= 0) {
      this.aimTimer = 0.1
      this.aim.hit = this.player.hooked ? null : this.findAnchor()
      this.aim.nape = this.nearestNape()
    }

    this.sound.update(speed, this.player.boosting)
    this.hudTimer -= realDt
    if (this.hudTimer <= 0) {
      this.hudTimer = 1 / 12
      this.emitHud()
    }
  }

  trySlash() {
    const player = this.player
    // nearestNape は作業用ベクトルを使うので、軌跡の位置より先に求める
    const nape = this.nearestNape()
    const forward = tmp2.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
    const slashPosition = tmp.copy(player.position).addScaledVector(forward, 1.6)
    this.effects.slash(slashPosition, this.camera.quaternion, Boolean(nape))
    this.sound.slash()
    if (!nape) return

    const titan = nape.titan
    titan.kill()
    this.titanMeshes = null
    player.detach()
    const speed = player.velocity.length()
    const now = this.elapsed
    this.combo = now - this.lastKill < 8 ? this.combo + 1 : 1
    this.lastKill = now
    const points = 100 * this.combo + Math.floor(speed) * 5 + Math.round(titan.height * 4)
    this.score += points
    this.kills += 1

    titan.napePosition(tmp)
    this.effects.emitSparks(tmp, 36)
    this.effects.emitSteam(tmp, titan.scale * 2, 18)
    this.sound.kill()
    this.slowTimer = this.reducedMotion ? 0 : 0.35
    this.shake = this.reducedMotion ? 0 : 0.5
    // 斬り抜けた勢いで少し上へ跳ねる
    player.velocity.y = Math.max(player.velocity.y, 9)
    this.onEvent?.({ type: 'kill', points, combo: this.combo, height: Math.round(titan.height) })
  }

  hurtPlayer(titan) {
    const player = this.player
    if (player.invulnerable > 0 || this.state !== 'playing') return
    player.hp -= 1
    player.invulnerable = 2
    player.detach()
    // つかまれそうになったら弾き飛ばされる
    const away = tmp.copy(player.position).sub(titan.position)
    away.y = 0
    away.normalize().multiplyScalar(22)
    player.velocity.copy(away).setY(14)
    this.shake = this.reducedMotion ? 0 : 0.9
    this.sound.hurt()
    this.onEvent?.({ type: 'hurt', hp: player.hp })
    if (player.hp <= 0) this.finish(false)
  }

  updateCamera(dt) {
    const player = this.player
    const speed = player.velocity.length()
    euler.set(this.pitch, this.yaw, 0)
    quat.setFromEuler(euler)
    const distance = 6.2 + Math.min(speed, 60) * 0.035
    const target = tmp.copy(player.position).add(tmp2.set(0, 1.4, 0))
    const desired = tmp2.set(0.9, 0.4, distance).applyQuaternion(quat).add(target)
    if (desired.y < 0.8) desired.y = 0.8
    const k = 1 - Math.exp(-14 * dt)
    this.cameraPosition.lerp(desired, k)
    this.camera.position.copy(this.cameraPosition)
    this.camera.quaternion.copy(quat)

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake = Math.max(0, this.shake - dt * 2)
    }

    // 速く飛ぶほど視野を広げてスピード感を出す
    const fov = 72 + (this.reducedMotion ? 0 : Math.min(speed, 60) / 60) * 16
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4)
      this.camera.updateProjectionMatrix()
    }
  }

  emitHud() {
    const p = this.player
    const alive = this.titans.filter((t) => t.alive).length
    this.onHud?.({
      hp: p.hp,
      gas: p.gas,
      score: this.score,
      wave: Math.min(this.waveIndex + 1, WAVES.length),
      waves: WAVES.length,
      remaining: alive,
      speed: p.velocity.length(),
      hooked: p.hooked,
      reticle: this.aim.nape ? 'nape' : this.aim.hit ? (this.aim.hit.titan ? 'titan' : 'hook') : 'none',
      combo: this.elapsed - this.lastKill < 8 ? this.combo : 0,
      boosting: p.boosting,
    })
  }
}
