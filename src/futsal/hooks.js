import { useCallback, useEffect, useMemo, useState } from 'react'
import { call } from './api.js'

// ---- ストレージ（使えない環境でも落ちないように try/catch で包む）

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
function writeJson(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できなくても動作は継続
  }
}

// ログイン状態はタブを閉じると消える sessionStorage に置く（共用端末での消し忘れ対策）
const sessionKey = (slug) => `futsal-session:${slug}`
export const loadSession = (slug) => readJson(sessionStorage, sessionKey(slug), null)
export const storeSession = (slug, session) => writeJson(sessionStorage, sessionKey(slug), session)

// 最近開いた大会（この端末だけの履歴）
const RECENT_KEY = 'futsal-recent'
export const loadRecent = () => readJson(localStorage, RECENT_KEY, [])
export function rememberTournament({ slug, name, event_date }) {
  const list = loadRecent().filter((t) => t.slug !== slug)
  writeJson(localStorage, RECENT_KEY, [{ slug, name, event_date }, ...list].slice(0, 8))
}

// ---- ルーティング（GitHub Pages はサーバー側のルーティングがないためハッシュで画面を切り替える）

const parseHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)

export function useHashRoute() {
  const [parts, setParts] = useState(parseHash)
  useEffect(() => {
    const onChange = () => {
      setParts(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parts
}

export const tournamentUrl = (slug) => `${location.origin}${location.pathname}#/t/${slug}`
export const navigate = (hash) => {
  window.location.hash = hash
}

/** チーム ID → チーム名 */
export function useTeamName(teams) {
  const map = useMemo(() => new Map(teams.map((x) => [x.id, x.name])), [teams])
  return useCallback((id) => map.get(id) ?? '（不明なチーム）', [map])
}

// ---- 大会データの取得。画面表示中は 30 秒ごと・画面に戻ったときに再取得して最新の得点を反映

export function useTournament(slug) {
  const [state, setState] = useState({ status: 'loading', data: null })

  const reload = useCallback(async () => {
    try {
      const data = await call('get_tournament', { p_slug: slug })
      setState({ status: data ? 'ready' : 'notfound', data })
      if (data) rememberTournament(data)
    } catch (e) {
      setState((s) => (s.data ? s : { status: 'error', data: null, error: e.message }))
    }
  }, [slug])

  useEffect(() => {
    reload()
    const refresh = () => document.visibilityState === 'visible' && reload()
    const timer = setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [reload])

  return { ...state, reload }
}
