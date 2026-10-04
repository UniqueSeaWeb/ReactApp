import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
    // カメラのすぐ近くの粒子は薄くして、画面が覆われないようにする
    vAlpha = aAlpha * smoothstep(1.5, 7.0, -mvPosition.z);
  }
`
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

// 1 種類の粒子をまとめて描くプール（生成・破棄を毎フレーム行わない）
class ParticlePool {
  constructor(scene, { count, color, additive = false, pixelRatio }) {
    this.count = count
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.sizes = new Float32Array(count)
    this.alphas = new Float32Array(count)
    this.life = new Float32Array(count)
    this.maxLife = new Float32Array(count)
    this.growth = new Float32Array(count)
    this.baseAlpha = new Float32Array(count)
    this.cursor = 0

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('aSize', new BufferAttribute(this.sizes, 1))
    geometry.setAttribute('aAlpha', new BufferAttribute(this.alphas, 1))
    this.geometry = geometry
    this.material = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) }, uPixelRatio: { value: pixelRatio } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.points = new Points(geometry, this.material)
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  emit(position, velocity, { size = 1, life = 1, alpha = 0.6, growth = 1 } = {}) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.count
    this.positions.set([position.x, position.y, position.z], i * 3)
    this.velocities.set([velocity.x, velocity.y, velocity.z], i * 3)
    this.sizes[i] = size
    this.life[i] = life
    this.maxLife[i] = life
    this.growth[i] = growth
    this.baseAlpha[i] = alpha
  }

  update(dt, drag = 1.5, lift = 0) {
    const damping = Math.exp(-drag * dt)
    for (let i = 0; i < this.count; i += 1) {
      if (this.life[i] <= 0) {
        this.alphas[i] = 0
        continue
      }
      this.life[i] -= dt
      const k = i * 3
      this.velocities[k] *= damping
      this.velocities[k + 1] = this.velocities[k + 1] * damping + lift * dt
      this.velocities[k + 2] *= damping
      this.positions[k] += this.velocities[k] * dt
      this.positions[k + 1] += this.velocities[k + 1] * dt
      this.positions[k + 2] += this.velocities[k + 2] * dt
      this.sizes[i] += this.growth[i] * dt
      const t = Math.max(this.life[i], 0) / this.maxLife[i]
      // 出始めは素早く現れ、ゆっくり消える
      this.alphas[i] = this.baseAlpha[i] * Math.min(1, (1 - t) * 6) * t
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aSize.needsUpdate = true
    this.geometry.attributes.aAlpha.needsUpdate = true
  }
}

const tmpPosition = new Vector3()
const tmpVelocity = new Vector3()

export class Effects {
  constructor(scene, pixelRatio) {
    this.scene = scene
    this.gas = new ParticlePool(scene, { count: 260, color: '#f4f1ea', pixelRatio })
    this.steam = new ParticlePool(scene, { count: 420, color: '#f2ece4', pixelRatio })
    this.sparks = new ParticlePool(scene, { count: 160, color: '#ffd28a', additive: true, pixelRatio })
    this.slashes = []
    this.slashGeometry = new RingGeometry(1.6, 2.3, 32, 1, -0.2, Math.PI * 0.95)
  }

  // 立体機動装置のガス噴射
  emitGas(position, backward, intensity = 1) {
    for (let i = 0; i < 2; i += 1) {
      tmpVelocity
        .copy(backward)
        .multiplyScalar(8 + Math.random() * 6)
        .add(tmpPosition.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5))
      this.gas.emit(position, tmpVelocity, { size: 0.5 * intensity, life: 0.7, alpha: 0.5, growth: 2.4 })
    }
  }

  // 討伐した巨人から立ち上る蒸気
  emitSteam(position, spread, count = 6) {
    for (let i = 0; i < count; i += 1) {
      tmpPosition.copy(position).add(tmpVelocity.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(spread))
      tmpVelocity.set((Math.random() - 0.5) * 2, 3 + Math.random() * 4, (Math.random() - 0.5) * 2)
      this.steam.emit(tmpPosition, tmpVelocity, { size: 2 + Math.random() * 3, life: 2.2 + Math.random() * 1.5, alpha: 0.35, growth: 3 })
    }
  }

  emitSparks(position, count = 24) {
    for (let i = 0; i < count; i += 1) {
      tmpVelocity.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(10 + Math.random() * 18)
      this.sparks.emit(position, tmpVelocity, { size: 0.35, life: 0.35 + Math.random() * 0.3, alpha: 1, growth: -0.4 })
    }
  }

  // 斬撃の軌跡（三日月形の光）
  slash(position, quaternion, hit) {
    const material = new MeshBasicMaterial({
      color: hit ? '#ffe2b0' : '#dfe9ff',
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const mesh = new Mesh(this.slashGeometry, material)
    mesh.position.copy(position)
    mesh.quaternion.copy(quaternion)
    mesh.rotateY(Math.PI / 2)
    mesh.rotateZ((Math.random() - 0.5) * 1.2)
    this.scene.add(mesh)
    this.slashes.push({ mesh, life: 0.28 })
  }

  update(dt) {
    this.gas.update(dt, 2.2, 0.5)
    this.steam.update(dt, 0.6, 1.5)
    this.sparks.update(dt, 3, -12)
    for (const s of this.slashes) {
      s.life -= dt
      s.mesh.material.opacity = Math.max(0, s.life / 0.28) * 0.9
      s.mesh.scale.setScalar(1 + (0.28 - s.life) * 1.5)
    }
    this.slashes = this.slashes.filter((s) => {
      if (s.life > 0) return true
      this.scene.remove(s.mesh)
      s.mesh.material.dispose()
      return false
    })
  }
}
