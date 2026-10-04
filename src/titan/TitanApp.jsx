import { useCallback, useEffect, useRef, useState } from 'react'
import { Game, QUALITY } from './game/Game.js'

const BEST_KEY = 'wire-blade:best'
const SETTINGS_KEY = 'wire-blade:settings'

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できない環境では何もしない
  }
}

function matches(query) {
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

const isTouchDevice = () => matches('(pointer: coarse)') || navigator.maxTouchPoints > 0
// 指がすでに離れているなどで捕捉できない場合も、入力処理は続ける
function capturePointer(event) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // 捕捉できなくても操作自体は有効
  }
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function Icon({ name }) {
  const paths = {
    pause: <path d="M8 5v14M16 5v14" />,
    back: <path d="M15 5l-7 7 7 7" />,
    sound: <path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />,
    mute: <path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" />,
    rotate: <path d="M4 7h10a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2zM17 3a5 5 0 0 1 4 5M21 8l-2-1M21 8l1-2" />,
  }
  return (
    <svg className="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}

const INITIAL_HUD = { hp: 3, gas: 100, score: 0, wave: 1, waves: 5, remaining: 0, speed: 0, hooked: false, reticle: 'none', combo: 0, boosting: false }

export default function TitanApp() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const joystickRef = useRef({ id: null, x: 0, y: 0 })
  const lookRef = useRef({ id: null, x: 0, y: 0 })
  const [touch] = useState(isTouchDevice)
  const [settings, setSettings] = useState(() =>
    readStorage(SETTINGS_KEY, { quality: isTouchDevice() ? 'standard' : 'high', muted: false }),
  )
  const [screen, setScreen] = useState('title') // title | playing | paused | result
  const [hud, setHud] = useState(INITIAL_HUD)
  const [result, setResult] = useState(null)
  const [best, setBest] = useState(() => readStorage(BEST_KEY, 0))
  const [popups, setPopups] = useState([])
  const [announce, setAnnounce] = useState('')
  const [banner, setBanner] = useState(null)
  const [flash, setFlash] = useState(0)
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false })
  const [portrait, setPortrait] = useState(false)
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  const showBanner = useCallback((text) => {
    setBanner({ text, id: Date.now() })
  }, [])

  // ゲーム本体の生成（画質を変えたら作り直す）
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).has('debug')
    const game = new Game(canvasRef.current, {
      quality: settings.quality,
      reducedMotion: matches('(prefers-reduced-motion: reduce)'),
      debug,
      onHud: setHud,
      onEvent: (event) => {
        if (event.type === 'kill') {
          const id = Date.now() + Math.random()
          setPopups((list) => [...list.slice(-3), { id, points: event.points, combo: event.combo }])
          setTimeout(() => setPopups((list) => list.filter((p) => p.id !== id)), 1300)
          setAnnounce(`${event.height} メートル級を討伐。${event.points} 点`)
          navigator.vibrate?.(40)
        } else if (event.type === 'hurt') {
          setFlash((n) => n + 1)
          setAnnounce(`攻撃を受けた。残り体力 ${event.hp}`)
          navigator.vibrate?.([60, 40, 60])
        } else if (event.type === 'wave') {
          showBanner(`第 ${event.wave} 波　巨人 ${event.count} 体`)
          setAnnounce(`第 ${event.wave} 波。巨人が ${event.count} 体接近中`)
        } else if (event.type === 'gameover' || event.type === 'clear') {
          setResult(event)
          setBest((previous) => {
            const next = Math.max(previous, event.score)
            writeStorage(BEST_KEY, next)
            return next
          })
          setScreen('result')
          document.exitPointerLock?.()
          setAnnounce(event.type === 'clear' ? `全ての巨人を討伐。スコア ${event.score}` : `力尽きた。スコア ${event.score}`)
        }
      },
    })
    game.sound.setMuted(settings.muted)
    game.input.touch = touch
    gameRef.current = game
    return () => game.dispose()
    // 音のオン／オフでは作り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality, touch, showBanner])

  useEffect(() => {
    writeStorage(SETTINGS_KEY, settings)
    gameRef.current?.sound.setMuted(settings.muted)
  }, [settings])

  const pause = useCallback(() => {
    if (screenRef.current !== 'playing') return
    gameRef.current?.pause()
    setScreen('paused')
    document.exitPointerLock?.()
  }, [])

  const resume = () => {
    setScreen('playing')
    screenRef.current = 'playing'
    gameRef.current?.resume()
  }

  const start = () => {
    const game = gameRef.current
    if (!game) return
    if (touch) {
      // スマホでは全画面・横向き固定を試みる（対応していない環境では無視される）
      document.documentElement.requestFullscreen?.().then(() => window.screen.orientation?.lock?.('landscape')).catch(() => {})
    }
    setResult(null)
    setPopups([])
    setScreen('playing')
    screenRef.current = 'playing'
    game.start()
  }

  const toTitle = () => {
    gameRef.current?.pause()
    gameRef.current?.reset()
    gameRef.current?.renderFrame()
    setScreen('title')
  }

  // タブを離れたら一時停止
  useEffect(() => {
    const onVisibility = () => document.hidden && pause()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])

  // 縦持ちの検出
  useEffect(() => {
    const check = () => setPortrait(touch && window.innerHeight > window.innerWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [touch])

  useEffect(() => {
    if (portrait) pause()
  }, [portrait, pause])

  // キーボードとマウス（PC 用）
  useEffect(() => {
    const keys = new Set()
    const syncMove = () => {
      const input = gameRef.current?.input
      if (!input) return
      input.moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
      input.moveY = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
      input.gas = keys.has('ShiftLeft') || keys.has('ShiftRight')
      input.anchor = keys.has('Space') || keys.has('mouse2')
    }
    const onKeyDown = (event) => {
      if (screenRef.current !== 'playing') return
      if (event.code === 'Escape' || event.code === 'KeyP') {
        pause()
        return
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      if ((event.code === 'KeyF' || event.code === 'KeyJ') && !event.repeat) gameRef.current.input.slash += 1
      keys.add(event.code)
      syncMove()
    }
    const onKeyUp = (event) => {
      keys.delete(event.code)
      syncMove()
    }
    const onMouseMove = (event) => {
      if (document.pointerLockElement !== canvasRef.current) return
      const input = gameRef.current?.input
      if (!input) return
      input.lookYaw += event.movementX * 0.0022
      input.lookPitch += event.movementY * 0.0022
    }
    const onMouseDown = (event) => {
      if (screenRef.current !== 'playing' || document.pointerLockElement !== canvasRef.current) return
      if (event.button === 0) gameRef.current.input.slash += 1
      if (event.button === 2) keys.add('mouse2')
      syncMove()
    }
    const onMouseUp = (event) => {
      if (event.button === 2) keys.delete('mouse2')
      syncMove()
    }
    const onLockChange = () => {
      if (!document.pointerLockElement && screenRef.current === 'playing' && !touch) pause()
    }
    const onBlur = () => {
      keys.clear()
      syncMove()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [pause, touch])

  const lockPointer = () => {
    if (!touch && screenRef.current === 'playing') canvasRef.current.requestPointerLock?.()
  }

  // ---- タッチ操作 ----
  const JOYSTICK_RADIUS = 52
  const onStickDown = (event) => {
    capturePointer(event)
    joystickRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    setKnob({ x: 0, y: 0, active: true })
  }
  const onStickMove = (event) => {
    const stick = joystickRef.current
    if (stick.id !== event.pointerId) return
    let dx = event.clientX - stick.x
    let dy = event.clientY - stick.y
    const length = Math.hypot(dx, dy)
    if (length > JOYSTICK_RADIUS) {
      dx = (dx / length) * JOYSTICK_RADIUS
      dy = (dy / length) * JOYSTICK_RADIUS
    }
    const input = gameRef.current.input
    input.moveX = dx / JOYSTICK_RADIUS
    input.moveY = -dy / JOYSTICK_RADIUS
    setKnob({ x: dx, y: dy, active: true })
  }
  const onStickUp = (event) => {
    if (joystickRef.current.id !== event.pointerId) return
    joystickRef.current.id = null
    const input = gameRef.current.input
    input.moveX = 0
    input.moveY = 0
    setKnob({ x: 0, y: 0, active: false })
  }

  // 右側のドラッグで視点を回す（ボタンを押したまま指を滑らせても回せる）
  const lookStart = (event) => {
    lookRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const lookMove = (event) => {
    const look = lookRef.current
    if (look.id !== event.pointerId) return
    const input = gameRef.current.input
    input.lookYaw += (event.clientX - look.x) * 0.006
    input.lookPitch += (event.clientY - look.y) * 0.0048
    input.lastLook = performance.now()
    look.x = event.clientX
    look.y = event.clientY
  }
  const lookEnd = (event) => {
    if (lookRef.current.id === event.pointerId) lookRef.current.id = null
  }
  const holdButton = (key) => ({
    onPointerDown: (event) => {
      event.stopPropagation()
      capturePointer(event)
      gameRef.current.input[key] = true
      lookStart(event)
    },
    onPointerMove: lookMove,
    onPointerUp: (event) => {
      gameRef.current.input[key] = false
      lookEnd(event)
    },
    onPointerCancel: (event) => {
      gameRef.current.input[key] = false
      lookEnd(event)
    },
    onContextMenu: (event) => event.preventDefault(),
  })

  const playing = screen === 'playing'
  const speedLines = Math.max(0, Math.min(1, (hud.speed - 24) / 30))

  return (
    <main className={`game ${touch ? 'game--touch' : 'game--mouse'}`} onContextMenu={(event) => playing && event.preventDefault()}>
      <div className="stage" role="img" aria-label="城壁に囲まれた街と巨大樹の森を立体機動で飛び回り、巨人と戦う 3D ゲームの画面">
        <canvas ref={canvasRef} onClick={lockPointer} />
      </div>

      {/* 画面効果 */}
      <div className="vignette" aria-hidden="true" />
      <div className="speed-lines" style={{ opacity: speedLines }} aria-hidden="true" />
      {flash > 0 && <div key={flash} className="damage-flash" aria-hidden="true" />}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>

      {playing && (
        <>
          <header className="hud">
            <div className="hud__left">
              <div className="hp" role="img" aria-label={`体力 ${hud.hp} / 3`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < hud.hp ? 'hp__pip hp__pip--on' : 'hp__pip'} />
                ))}
              </div>
              <div className="gas">
                <label htmlFor="gas-meter" className="gas__label">
                  ガス
                </label>
                <meter id="gas-meter" className={hud.gas < 25 ? 'gas__meter gas__meter--low' : 'gas__meter'} min={0} max={100} low={25} optimum={100} value={hud.gas}>
                  {Math.round(hud.gas)}%
                </meter>
              </div>
            </div>
            <div className="hud__center">
              <p className="wave">
                第 {hud.wave} / {hud.waves} 波
              </p>
              <p className="remaining">残り {hud.remaining} 体</p>
            </div>
            <div className="hud__right">
              <p className="score">
                <span className="score__label">SCORE</span>
                <span className="score__value">{hud.score.toLocaleString('ja-JP')}</span>
              </p>
              <button type="button" className="round-button" onClick={pause} aria-label="一時停止">
                <Icon name="pause" />
              </button>
            </div>
          </header>

          <div className={`reticle reticle--${hud.reticle}`} aria-hidden="true">
            <span />
          </div>
          {hud.reticle === 'nape' && (
            <p className="prompt prompt--nape" aria-hidden="true">
              うなじを斬れ！
            </p>
          )}
          {hud.combo > 1 && (
            <p className="combo" aria-hidden="true">
              {hud.combo} 連続討伐
            </p>
          )}
          <div className="popups" aria-hidden="true">
            {popups.map((p) => (
              <p key={p.id} className="popup">
                +{p.points}
              </p>
            ))}
          </div>
          {banner && (
            <p key={banner.id} className="banner" aria-hidden="true" onAnimationEnd={() => setBanner(null)}>
              {banner.text}
            </p>
          )}

          {touch && (
            <div className="touch" aria-hidden="true">
              <div className="stick-zone" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp}>
                <div className={knob.active ? 'stick stick--active' : 'stick'}>
                  <span className="stick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
                </div>
              </div>
              <div className="look-zone" onPointerDown={lookStart} onPointerMove={lookMove} onPointerUp={lookEnd} onPointerCancel={lookEnd}>
                <div className="actions">
                  <button type="button" tabIndex={-1} className="action action--gas" {...holdButton('gas')}>
                    ガス
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="action action--slash"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      gameRef.current.input.slash += 1
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    斬る
                  </button>
                  <button type="button" tabIndex={-1} className={hud.hooked ? 'action action--anchor action--on' : 'action action--anchor'} {...holdButton('anchor')}>
                    アンカー
                  </button>
                </div>
              </div>
            </div>
          )}
          {!touch && (
            <p className="mouse-hint" aria-hidden="true">
              クリックで視点操作を開始 ・ Esc で一時停止
            </p>
          )}
        </>
      )}

      {screen === 'title' && (
        <section className="overlay overlay--title" aria-labelledby="title-heading">
          <div className="card card--title">
            <p className="kicker">立体機動アクション</p>
            <h1 id="title-heading" className="logo">
              WIRE BLADE
              <span className="logo__sub">巨人討伐</span>
            </h1>
            <p className="lead">城壁の街と巨大樹の森を、ワイヤーとガスで飛び回れ。巨人のうなじを斬って、5 つの波を退けろ。</p>
            <button type="button" className="primary-button" onClick={start}>
              出撃する
            </button>
            {best > 0 && <p className="best">ベストスコア {best.toLocaleString('ja-JP')}</p>}

            <div className="settings">
              <fieldset className="segmented">
                <legend>画質</legend>
                {Object.entries(QUALITY).map(([key, { label }]) => (
                  <label key={key} className="segmented__option">
                    <input type="radio" name="quality" value={key} checked={settings.quality === key} onChange={() => setSettings((s) => ({ ...s, quality: key }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <button type="button" className="round-button" aria-pressed={!settings.muted} onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))} aria-label="効果音">
                <Icon name={settings.muted ? 'mute' : 'sound'} />
              </button>
            </div>

            <details className="howto">
              <summary>操作方法</summary>
              <div className="howto__grid">
                <section>
                  <h2>スマホ（横持ち）</h2>
                  <dl>
                    <div><dt>左スティック</dt><dd>移動・空中での方向調整</dd></div>
                    <div><dt>右側をドラッグ</dt><dd>視点を回す</dd></div>
                    <div><dt>アンカー（長押し）</dt><dd>照準の先にワイヤーを刺して巻き取る。離すと外れる</dd></div>
                    <div><dt>ガス（長押し）</dt><dd>向いている方向へ加速</dd></div>
                    <div><dt>斬る</dt><dd>うなじの近くで押すと討伐</dd></div>
                  </dl>
                </section>
                <section>
                  <h2>PC</h2>
                  <dl>
                    <div><dt>W A S D</dt><dd>移動</dd></div>
                    <div><dt>マウス</dt><dd>視点（画面をクリックで開始）</dd></div>
                    <div><dt>Space / 右クリック</dt><dd>アンカー（押している間）</dd></div>
                    <div><dt>Shift</dt><dd>ガス</dd></div>
                    <div><dt>左クリック / F</dt><dd>斬る</dd></div>
                  </dl>
                </section>
              </div>
              <p className="howto__tip">照準が橙色になったら「斬る」のチャンス。巨人の腕に近づきすぎると弾き飛ばされます。</p>
            </details>
            <a className="text-link" href="../">
              <Icon name="back" />
              ToDo に戻る
            </a>
          </div>
        </section>
      )}

      {screen === 'paused' && (
        <section className="overlay" aria-labelledby="pause-heading">
          <div className="card card--menu">
            <h1 id="pause-heading" className="menu-title">一時停止中</h1>
            <button type="button" className="primary-button" onClick={resume}>
              再開する
            </button>
            <button type="button" className="secondary-button" onClick={start}>
              最初からやり直す
            </button>
            <button type="button" className="secondary-button" onClick={toTitle}>
              タイトルに戻る
            </button>
          </div>
        </section>
      )}

      {screen === 'result' && result && (
        <section className="overlay" aria-labelledby="result-heading">
          <div className="card card--menu">
            <p className="kicker">{result.type === 'clear' ? 'MISSION COMPLETE' : 'MISSION FAILED'}</p>
            <h1 id="result-heading" className="menu-title">{result.type === 'clear' ? '全ての巨人を討伐した' : '力尽きた……'}</h1>
            <dl className="stats">
              <div><dt>スコア</dt><dd>{result.score.toLocaleString('ja-JP')}</dd></div>
              <div><dt>討伐数</dt><dd>{result.kills} 体</dd></div>
              <div><dt>到達</dt><dd>第 {result.wave} 波</dd></div>
              <div><dt>時間</dt><dd>{formatTime(result.time)}</dd></div>
            </dl>
            {result.score >= best && result.score > 0 && <p className="best best--new">ベストスコア更新！</p>}
            <button type="button" className="primary-button" onClick={start}>
              もう一度出撃する
            </button>
            <button type="button" className="secondary-button" onClick={toTitle}>
              タイトルに戻る
            </button>
          </div>
        </section>
      )}

      {portrait && (
        <div className="rotate" role="alert">
          <Icon name="rotate" />
          <p>端末を横向きにして遊んでください</p>
        </div>
      )}
    </main>
  )
}
