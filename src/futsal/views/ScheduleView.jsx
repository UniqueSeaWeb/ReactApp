import { useMemo, useState } from 'react'
import { scoresByMatch } from '../logic.js'
import { formatTime } from '../format.js'
import { useTeamName } from '../hooks.js'
import { Field } from '../ui.jsx'

function MatchCard({ match, slug, teamName, score }) {
  const home = teamName(match.home_team_id)
  const away = teamName(match.away_team_id)
  const played = match.finished || score
  const hs = score?.[match.home_team_id] ?? 0
  const as = score?.[match.away_team_id] ?? 0
  return (
    <a className={`match-card${match.finished ? ' finished' : ''}`} href={`#/t/${slug}/match/${match.id}`}>
      <span className="mc-meta">
        <span className="court">{match.court}</span>
        <span>第{match.seq}試合</span>
        <span className={`status ${match.finished ? 'done' : played ? 'live' : ''}`}>
          {match.finished ? '終了' : played ? '試合中' : '試合前'}
        </span>
      </span>
      {/* スマホでも長いチーム名が読みやすいよう、1 チーム 1 行で表示 */}
      <span className="mc-row">
        <span className="team">{home}</span>
        <span className="pts">{played ? hs : ''}</span>
      </span>
      <span className="visually-hidden">対</span>
      <span className="mc-row">
        <span className="team">{away}</span>
        <span className="pts">{played ? as : ''}</span>
      </span>
    </a>
  )
}

export default function ScheduleView({ ctx }) {
  const { t, slug, isAdmin } = ctx
  const [teamFilter, setTeamFilter] = useState('')
  const teamName = useTeamName(t.teams)
  const scores = useMemo(() => scoresByMatch(t.goals), [t.goals])

  // 開始時刻ごとにまとめる
  const slots = useMemo(() => {
    const filtered = teamFilter
      ? t.matches.filter((m) => m.home_team_id === teamFilter || m.away_team_id === teamFilter)
      : t.matches
    return Map.groupBy(filtered, (m) => m.start_at)
  }, [t.matches, teamFilter])

  if (t.matches.length === 0) {
    return (
      <section className="card empty-state">
        <h2>対戦表はまだありません</h2>
        {isAdmin ? (
          <p>
            <a className="btn primary" href={`#/t/${slug}/admin`}>チームを登録して対戦表を作る</a>
          </p>
        ) : (
          <p>主催者が対戦表を作成すると、ここに表示されます。</p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="schedule-heading">
      <div className="section-head">
        <h2 id="schedule-heading">対戦表</h2>
        <Field label="チームで絞り込む">
          {(p) => (
            <select {...p} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">すべての試合</option>
              {t.teams.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="hint">試合を選ぶと、得点者などの詳細を確認・入力できます。</p>
      {[...slots].map(([start, matches]) => (
        <section key={start} className="slot">
          <h3 className="slot-time">
            <time dateTime={start}>{formatTime(start)}</time> 開始
          </h3>
          <ul className="match-grid">
            {matches.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} slug={slug} teamName={teamName} score={scores[m.id]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {slots.size === 0 && <p className="empty">このチームの試合はありません。</p>}
    </section>
  )
}
