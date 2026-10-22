import { useCallback, useEffect, useMemo, useState } from 'react'
import { call, isDemo } from './api.js'
import { loadSession, storeSession, tournamentUrl, useHashRoute, useTournament } from './hooks.js'
import { formatDate } from './format.js'
import { AsyncForm, Dialog, Field, ShareButton } from './ui.jsx'
import Home from './views/Home.jsx'
import ScheduleView from './views/ScheduleView.jsx'
import MatchView from './views/MatchView.jsx'
import { StandingsView, ScorersView } from './views/RankingViews.jsx'
import TeamsView from './views/TeamsView.jsx'
import AdminView from './views/AdminView.jsx'

const TABS = [
  { key: 'schedule', label: '対戦表' },
  { key: 'standings', label: '順位' },
  { key: 'scorers', label: '個人得点' },
  { key: 'teams', label: 'チーム' },
  { key: 'admin', label: '管理', adminOnly: true },
]
const SLUG_RE = /^[A-Za-z0-9_-]{12}$/

// 画面下部の通知。エラーは role="alert" で即時に読み上げる
function useNotice() {
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [notice])
  const notify = useCallback((text, kind = 'info') => setNotice({ text, kind, at: Date.now() }), [])
  const view = (
    <div className="notice-area">
      <p role="status" className={notice?.kind === 'info' ? 'notice' : 'visually-hidden'}>
        {notice?.kind === 'info' ? notice.text : ''}
      </p>
      <p role="alert" className={notice?.kind === 'error' ? 'notice error' : 'visually-hidden'}>
        {notice?.kind === 'error' ? notice.text : ''}
      </p>
    </div>
  )
  return [notify, view]
}

export default function FutsalApp() {
  const [notify, noticeView] = useNotice()
  const [section, slug, ...rest] = useHashRoute()
  const inTournament = section === 't' && SLUG_RE.test(slug ?? '')

  return (
    <>
      <a className="skip-link" href="#main">本文へスキップ</a>
      {isDemo && (
        <p className="demo-banner">
          デモモード: データはこの端末のブラウザにだけ保存され、他の人とは共有されません。
        </p>
      )}
      {inTournament ? (
        <Tournament key={slug} slug={slug} rest={rest} notify={notify} />
      ) : (
        <Home notify={notify} />
      )}
      {noticeView}
    </>
  )
}

function Tournament({ slug, rest, notify }) {
  const { status, data, error, reload } = useTournament(slug)
  const [session, setSession] = useState(() => loadSession(slug))
  const [loginOpen, setLoginOpen] = useState(false)
  const [tab = 'schedule', id] = rest
  const isAdmin = session?.role === 'admin'

  const updateSession = useCallback(
    (s) => {
      storeSession(slug, s)
      setSession(s)
    },
    [slug],
  )

  // 認証が必要な操作の共通処理: トークン付与 → 実行 → 再取得 → 結果を通知
  const run = useCallback(
    async (fn, args, successText) => {
      try {
        await call(fn, { p_token: session?.token, ...args })
        await reload()
        if (successText) notify(successText)
        return true
      } catch (e) {
        if (e.code === 'UNAUTHORIZED') {
          updateSession(null)
          setLoginOpen(true)
        }
        notify(e.message, 'error')
        return false
      }
    },
    [session, reload, notify, updateSession],
  )

  const login = async (fd) => {
    try {
      const s = await call('login', { p_slug: slug, p_password: fd.get('password') })
      updateSession(s)
      setLoginOpen(false)
      notify(s.role === 'admin' ? '管理者としてログインしました。' : '参加者としてログインしました。')
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  const logout = () => {
    call('logout', { p_token: session.token }).catch(() => {})
    updateSession(null)
    notify('ログアウトしました。')
  }

  const ctx = useMemo(
    () => ({
      t: data,
      slug,
      session,
      isAdmin,
      canEdit: !!session,
      run,
      notify,
      requestLogin: () => setLoginOpen(true),
    }),
    [data, slug, session, isAdmin, run, notify],
  )

  useEffect(() => {
    if (data) document.title = `${data.name} | フットサル大会`
  }, [data])

  if (status === 'loading') return <main id="main" className="page center-msg" aria-busy="true">読み込み中…</main>
  if (status !== 'ready') {
    return (
      <main id="main" className="page center-msg">
        <h1>{status === 'notfound' ? '大会が見つかりません' : '読み込めませんでした'}</h1>
        <p>{status === 'notfound' ? 'URL が正しいか、主催者に確認してください。' : error}</p>
        <p>
          <a className="btn" href="#/">トップへ戻る</a>
        </p>
      </main>
    )
  }

  const tabs = TABS.filter((x) => !x.adminOnly || isAdmin)
  const activeTab = tab === 'match' ? 'schedule' : tab
  let content
  if (tab === 'match') content = <MatchView ctx={ctx} matchId={id} />
  else if (tab === 'standings') content = <StandingsView ctx={ctx} />
  else if (tab === 'scorers') content = <ScorersView ctx={ctx} />
  else if (tab === 'teams') content = <TeamsView ctx={ctx} teamId={id} />
  else if (tab === 'admin' && isAdmin) content = <AdminView ctx={ctx} />
  else content = <ScheduleView ctx={ctx} />

  return (
    <>
      <header className="t-header">
        <div className="page">
          <p className="crumb">
            <a href="../">アプリ一覧</a> <span aria-hidden="true">／</span> <a href="#/">フットサル大会メーカー</a>
          </p>
          <h1 className="t-title">{data.name}</h1>
          <p className="t-meta">
            <span>{formatDate(data.event_date)}</span>
            <span>主催: {data.organizer}</span>
          </p>
          <div className="t-actions">
            <ShareButton url={tournamentUrl(slug)} title={data.name} notify={notify} />
            {session ? (
              <>
                <span className="role-badge">{isAdmin ? '管理者' : '参加者'}でログイン中</span>
                <button type="button" className="btn" onClick={logout}>ログアウト</button>
              </>
            ) : (
              <button type="button" className="btn primary" onClick={() => setLoginOpen(true)}>ログイン</button>
            )}
          </div>
        </div>
        <nav className="tabs" aria-label="大会メニュー">
          <ul className="page">
            {tabs.map((x) => (
              <li key={x.key}>
                <a href={`#/t/${slug}/${x.key}`} aria-current={activeTab === x.key ? 'page' : undefined}>
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="page">
        {content}
      </main>
      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} title="ログイン">
        <AsyncForm onSubmit={login}>
          <p className="hint">
            参加者は主催者から伝えられた<strong>合言葉</strong>を、主催者は<strong>管理者パスワード</strong>を入力してください。
          </p>
          <Field label="合言葉 または 管理者パスワード">
            {(p) => (
              <input {...p} name="password" type="password" required autoComplete="current-password" autoFocus />
            )}
          </Field>
          <button type="submit" className="btn primary block">ログイン</button>
        </AsyncForm>
      </Dialog>
    </>
  )
}
