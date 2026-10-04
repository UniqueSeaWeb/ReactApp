// 効果音はすべて Web Audio で合成する（音声ファイルを使わない）
export class Sound {
  constructor() {
    this.context = null
    this.muted = false
  }

  // ブラウザの自動再生制限のため、ユーザー操作の中で呼ぶ
  start() {
    if (this.context) {
      this.context.resume()
      return
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    this.context = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.7
    this.master.connect(ctx.destination)

    const length = ctx.sampleRate * 2
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1

    // 風切り音とガス噴射音は鳴らしっぱなしにして音量だけ変える
    this.wind = this.loop('lowpass', 500, 0)
    this.gasLoop = this.loop('bandpass', 1800, 0)
  }

  loop(type, frequency, volume) {
    const ctx = this.context
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(filter).connect(gain).connect(this.master)
    source.start()
    return { gain, filter }
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.7
  }

  suspend() {
    this.context?.suspend()
  }

  // 速度とガス噴射に合わせて環境音を更新する
  update(speed, boosting) {
    if (!this.context) return
    const now = this.context.currentTime
    this.wind.gain.gain.setTargetAtTime(Math.min(0.5, (speed / 60) ** 2 * 0.6), now, 0.1)
    this.wind.filter.frequency.setTargetAtTime(300 + speed * 18, now, 0.1)
    this.gasLoop.gain.gain.setTargetAtTime(boosting ? 0.22 : 0, now, 0.05)
  }

  burst({ type = 'bandpass', frequency = 1000, q = 1, duration = 0.2, volume = 0.5, sweepTo }) {
    if (!this.context) return
    const ctx = this.context
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(frequency, now)
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, now + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    source.connect(filter).connect(gain).connect(this.master)
    source.start(now, Math.random())
    source.stop(now + duration + 0.05)
  }

  tone({ frequency = 440, to, duration = 0.15, volume = 0.3, type = 'square' }) {
    if (!this.context) return
    const ctx = this.context
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, now)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, now + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.05)
  }

  hook() {
    this.tone({ frequency: 1400, to: 300, duration: 0.08, volume: 0.12 })
    this.burst({ type: 'highpass', frequency: 3000, duration: 0.12, volume: 0.25 })
  }

  slash() {
    this.burst({ type: 'bandpass', frequency: 5000, sweepTo: 1500, q: 2, duration: 0.18, volume: 0.6 })
  }

  kill() {
    this.burst({ type: 'bandpass', frequency: 2500, sweepTo: 600, q: 1.5, duration: 0.35, volume: 0.7 })
    this.tone({ frequency: 120, to: 45, duration: 0.5, volume: 0.5, type: 'sine' })
  }

  hurt() {
    this.tone({ frequency: 90, to: 40, duration: 0.4, volume: 0.6, type: 'sawtooth' })
    this.burst({ type: 'lowpass', frequency: 600, duration: 0.3, volume: 0.6 })
  }

  wave() {
    this.tone({ frequency: 220, duration: 0.6, volume: 0.15, type: 'triangle' })
    this.tone({ frequency: 330, duration: 0.9, volume: 0.12, type: 'triangle' })
  }
}
