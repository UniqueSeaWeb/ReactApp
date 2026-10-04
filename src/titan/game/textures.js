import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// 画像ファイルを使わず、Canvas で質感のあるテクスチャを描く。
// シード付き乱数で、毎回同じ見た目になるようにしている。
export function createRandom(seed = 1) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function makeTexture(width, height, draw, { repeat = [1, 1] } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = 8
  return texture
}

function noise(ctx, width, height, random, count, colors, minSize, maxSize, alpha) {
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = alpha * (0.4 + random() * 0.6)
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    const size = minSize + random() * (maxSize - minSize)
    ctx.fillRect(random() * width, random() * height, size, size)
  }
  ctx.globalAlpha = 1
}

// 草地と土が混じった地面
export function groundTexture() {
  const random = createRandom(11)
  return makeTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#5f6b3a'
      ctx.fillRect(0, 0, w, h)
      noise(ctx, w, h, random, 9000, ['#6d7a42', '#566234', '#7b8448', '#4c5730'], 1, 4, 0.5)
      // 土の斑
      for (let i = 0; i < 40; i += 1) {
        ctx.globalAlpha = 0.18
        ctx.fillStyle = '#8a7650'
        ctx.beginPath()
        ctx.ellipse(random() * w, random() * h, 10 + random() * 40, 6 + random() * 20, random() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    },
    { repeat: [70, 70] },
  )
}

// 石畳（広場）
export function cobbleTexture() {
  const random = createRandom(23)
  return makeTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#6e665b'
      ctx.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 16) {
        const offset = (y / 16) % 2 ? 8 : 0
        for (let x = -16; x < w; x += 20) {
          const shade = 95 + Math.floor(random() * 40)
          ctx.fillStyle = `rgb(${shade + 10}, ${shade + 4}, ${shade - 6})`
          ctx.fillRect(x + offset + 1, y + 1, 18, 14)
        }
      }
      noise(ctx, w, h, random, 1500, ['#3f3a33', '#9a9284'], 1, 2, 0.4)
    },
    { repeat: [12, 12] },
  )
}

// 木組みの漆喰壁と窓（建物の外壁）
export function facadeTexture() {
  const random = createRandom(37)
  return makeTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e9e0cc'
    ctx.fillRect(0, 0, w, h)
    noise(ctx, w, h, random, 3000, ['#d8cdb4', '#f3ecdc', '#cfc3a8'], 1, 3, 0.5)
    // 木の梁
    ctx.fillStyle = '#4a3423'
    for (let y = 0; y <= h; y += 64) ctx.fillRect(0, y - 4, w, 8)
    for (let x = 0; x <= w; x += 64) ctx.fillRect(x - 4, 0, 8, h)
    // 斜めの筋交い
    ctx.strokeStyle = '#4a3423'
    ctx.lineWidth = 6
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath()
      ctx.moveTo(0, y + 64)
      ctx.lineTo(18, y + 40)
      ctx.moveTo(w, y + 64)
      ctx.lineTo(w - 18, y + 40)
      ctx.stroke()
    }
    // 窓
    for (let y = 0; y < h; y += 64) {
      for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = '#3b3328'
        ctx.fillRect(x + 22, y + 16, 20, 30)
        ctx.fillStyle = random() < 0.25 ? '#e9b56a' : '#2a3442'
        ctx.fillRect(x + 24, y + 18, 16, 26)
        ctx.fillStyle = '#4a3423'
        ctx.fillRect(x + 31, y + 18, 2, 26)
        ctx.fillRect(x + 24, y + 29, 16, 2)
      }
    }
  })
}

// 屋根瓦
export function roofTexture() {
  const random = createRandom(41)
  return makeTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a4a32'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 12) {
      const offset = (y / 12) % 2 ? 8 : 0
      for (let x = -16; x < w; x += 16) {
        const shade = Math.floor(random() * 30)
        ctx.fillStyle = `rgb(${130 + shade}, ${66 + shade / 2}, ${44 + shade / 3})`
        ctx.fillRect(x + offset, y, 15, 10)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(x + offset, y + 9, 15, 2)
      }
    }
  })
}

// 城壁の石積み
export function stoneTexture() {
  const random = createRandom(53)
  return makeTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7d776c'
      ctx.fillRect(0, 0, w, h)
      for (let y = 0; y < h; y += 32) {
        const offset = (y / 32) % 2 ? 32 : 0
        for (let x = -64; x < w; x += 64) {
          const shade = 105 + Math.floor(random() * 35)
          ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`
          ctx.fillRect(x + offset + 2, y + 2, 60, 28)
        }
      }
      noise(ctx, w, h, random, 6000, ['#4f4a42', '#a49c8d', '#6a645a'], 1, 3, 0.35)
      // 雨だれの汚れ
      for (let i = 0; i < 60; i += 1) {
        ctx.globalAlpha = 0.08
        ctx.fillStyle = '#2e2a25'
        ctx.fillRect(random() * w, 0, 2 + random() * 6, h)
      }
      ctx.globalAlpha = 1
    },
    { repeat: [40, 2] },
  )
}

// 樹皮
export function barkTexture() {
  const random = createRandom(61)
  return makeTexture(
    128,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#5a4331'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 220; i += 1) {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = random() < 0.5 ? '#3a2a1e' : '#76594183'
        ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 20 + random() * 80)
      }
      ctx.globalAlpha = 1
    },
    { repeat: [2, 6] },
  )
}
