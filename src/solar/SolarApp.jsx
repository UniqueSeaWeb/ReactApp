import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { BODIES } from './bodies.js'
import Scene from './Scene.jsx'

// 「1 秒あたり何日進むか」の段階
const SPEEDS = [1, 7, 30, 90, 365]
const DEFAULT_SPEED_INDEX = 2

const dateFormatter = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' })

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function formatSpeed(days) {
  if (days === 1) return '1 日'
  if (days === 7) return '1 週間'
  if (days === 30) return '約 1 か月'
  if (days === 90) return '約 3 か月'
  return '約 1 年'
}

function Icon({ name }) {
  const paths = {
    play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
    pause: <path d="M8 5v14M16 5v14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    back: <path d="M15 5l-7 7 7 7" />,
    reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />,
  }
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

export default function SolarApp() {
  const [startDate] = useState(() => new Date())
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const [selectedId, setSelectedId] = useState(null)
  const [showOrbits, setShowOrbits] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [days, setDays] = useState(0)
  const simRef = useRef({ days: 0, playing, speed: SPEEDS[speedIndex] })
  const transitionRef = useRef(false)
  const labelRefs = useRef(new Map())

  // 描画ループに渡す値は ref で共有し、React の再描画を減らす
  useEffect(() => {
    simRef.current.playing = playing
    simRef.current.speed = SPEEDS[speedIndex]
  }, [playing, speedIndex])

  // 経過日数の表示は 4 回/秒だけ更新する
  useEffect(() => {
    const timer = setInterval(() => setDays(simRef.current.days), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function select(id) {
    transitionRef.current = true
    setSelectedId(id)
  }

  const resetTime = () => {
    simRef.current.days = 0
    setDays(0)
  }

  const selected = BODIES.find((body) => body.id === selectedId)
  const currentDate = new Date(startDate.getTime() + days * 86400000)

  return (
    <div className="solar">
      <header className="topbar">
        <a className="back-link" href="../">
          <Icon name="back" />
          <span>ToDo に戻る</span>
        </a>
        <div className="title">
          <h1>太陽系ビューア</h1>
          <p className="date">
            <time dateTime={currentDate.toISOString().slice(0, 10)}>{dateFormatter.format(currentDate)}</time>
          </p>
        </div>
      </header>
      <main>
        <div
          className="viewport"
          role="img"
          aria-label="太陽と 8 つの惑星が公転する様子の 3D 表示。ドラッグで回転、ホイールやピンチで拡大縮小できます。天体は下の一覧からも選べます。"
        >
          <Canvas
            camera={{ position: [0, 90, 95], fov: 45, near: 0.1, far: 1000 }}
            dpr={[1, 2]}
            onPointerMissed={() => selectedId && select(null)}
          >
            <Scene
              simRef={simRef}
              selectedId={selectedId}
              onSelect={select}
              showOrbits={showOrbits}
              labelRefs={labelRefs}
              transitionRef={transitionRef}
            />
          </Canvas>
          <div className="labels" aria-hidden="true" hidden={!showLabels}>
            {BODIES.map((body) => (
              <span
                key={body.id}
                ref={(element) => {
                  if (element) labelRefs.current.set(body.id, element)
                  else labelRefs.current.delete(body.id)
                }}
                className={selectedId === body.id ? 'body-label body-label--selected' : 'body-label'}
              >
                {body.name}
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <section className="bodies" aria-labelledby="bodies-heading">
            <h2 id="bodies-heading" className="panel__heading">
              天体を選ぶ
            </h2>
            <ul className="body-list">
              {BODIES.map((body) => (
                <li key={body.id}>
                  <button
                    type="button"
                    className="body-chip"
                    aria-pressed={selectedId === body.id}
                    onClick={() => select(selectedId === body.id ? null : body.id)}
                  >
                    <span className="body-chip__dot" style={{ background: body.color ?? body.texture.colors[0] }} />
                    {body.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="info" aria-live="polite" aria-labelledby="info-heading">
            {selected ? (
              <>
                <div className="info__header">
                  <div>
                    <p className="info__kind">
                      {selected.kind}・{selected.nameEn}
                    </p>
                    <h2 id="info-heading" className="info__name">
                      {selected.name}
                    </h2>
                  </div>
                  <button type="button" className="icon-button" onClick={() => select(null)} aria-label="選択を解除して全体を表示">
                    <Icon name="close" />
                  </button>
                </div>
                <p className="info__description">{selected.description}</p>
                <dl className="facts">
                  {selected.facts.map(([term, value]) => (
                    <div key={term} className="facts__row">
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <h2 id="info-heading" className="info__name info__name--small">
                  太陽系の全体
                </h2>
                <p className="info__description">
                  天体をクリックするか、上の一覧から選ぶと、その天体に近づいて詳しい情報を表示します。
                </p>
                <p className="info__note">大きさと距離は見やすいように縮めて表示しています。</p>
              </>
            )}
          </section>
        </div>

        <section className="controls" aria-label="時間の操作と表示設定">
          <button
            type="button"
            className="play-button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? '一時停止' : '再生'}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>

          <div className="speed">
            <label htmlFor="speed">速さ</label>
            <input
              id="speed"
              type="range"
              min={0}
              max={SPEEDS.length - 1}
              step={1}
              value={speedIndex}
              onChange={(event) => setSpeedIndex(Number(event.target.value))}
              aria-valuetext={`1 秒で${formatSpeed(SPEEDS[speedIndex])}`}
            />
            <output htmlFor="speed" className="speed__value">
              1 秒 = {formatSpeed(SPEEDS[speedIndex])}
            </output>
          </div>

          <p className="elapsed">
            <span className="elapsed__label">経過</span>
            <span className="elapsed__value">{Math.floor(days).toLocaleString('ja-JP')} 日</span>
          </p>

          <button type="button" className="icon-button" onClick={resetTime} aria-label="今日に戻す">
            <Icon name="reset" />
          </button>

          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={showOrbits} onChange={(event) => setShowOrbits(event.target.checked)} />
              <span>軌道</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
              <span>名前</span>
            </label>
          </div>
        </section>
      </main>
    </div>
  )
}
