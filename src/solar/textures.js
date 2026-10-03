import { CanvasTexture, SRGBColorSpace } from 'three'

// 画像ファイルを使わず、惑星の表面模様を Canvas で描く。
// 同じ見た目を毎回再現できるよう、シード付きの乱数を使う。
function createRandom(seed) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function seedFrom(text) {
  return [...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)
}

function drawBanded(ctx, width, height, colors, random) {
  let y = 0
  while (y < height) {
    const band = 3 + random() * 14
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    ctx.fillRect(0, y, width, band + 1)
    y += band
  }
  // 帯の境目をゆらがせる
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    ctx.fillRect(random() * width, random() * height, 20 + random() * 60, 1 + random() * 2)
  }
  ctx.globalAlpha = 1
}

function drawRocky(ctx, width, height, colors, random) {
  ctx.fillStyle = colors[0]
  ctx.fillRect(0, 0, width, height)
  for (let i = 0; i < 260; i += 1) {
    ctx.globalAlpha = 0.15 + random() * 0.35
    ctx.fillStyle = colors[1 + Math.floor(random() * (colors.length - 1))]
    ctx.beginPath()
    ctx.arc(random() * width, random() * height, 1 + random() * 9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawEarth(ctx, width, height, [ocean, land, cloud], random) {
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = land
  // 大陸は 6 つの塊として描き、海が 7 割ほどになるようにする
  for (let i = 0; i < 6; i += 1) {
    const cx = random() * width
    const cy = height * (0.2 + random() * 0.6)
    for (let j = 0; j < 14; j += 1) {
      ctx.beginPath()
      ctx.arc(cx + (random() - 0.5) * 40, cy + (random() - 0.5) * 26, 3 + random() * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // 極地の氷
  ctx.fillStyle = cloud
  ctx.fillRect(0, 0, width, height * 0.06)
  ctx.fillRect(0, height * 0.94, width, height * 0.06)
  // 雲
  ctx.globalAlpha = 0.4
  for (let i = 0; i < 50; i += 1) {
    ctx.fillRect(random() * width, random() * height, 15 + random() * 45, 1 + random() * 3)
  }
  ctx.globalAlpha = 1
}

const DRAWERS = { banded: drawBanded, rocky: drawRocky, earth: drawEarth }

export function createPlanetTexture(id, { type, colors }) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  DRAWERS[type](ctx, canvas.width, canvas.height, colors, createRandom(seedFrom(id)))
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
