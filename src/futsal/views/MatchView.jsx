import { useState } from 'react'
import { formatTime, memberLabel } from '../format.js'
import { useTeamName } from '../hooks.js'
import { AsyncForm, Field } from '../ui.jsx'

const OWN_GOAL = 'own-goal'

function GoalForm({ match, ctx, teamName }) {
  const { t, run } = ctx
  const sides = [match.home_team_id, match.away_team_id]
  const [teamId, setTeamId] = useState(sides[0])
  const members = t.members.filter((m) => m.team_id === teamId)

  const submit = (fd) => {
    const scorer = fd.get('scorer')
    return run(
      'add_goal',
      {
        p_match_id: match.id,
        p_team_id: teamId,
        p_member_id: scorer === OWN_GOAL ? null : scorer,
        p_own_goal: scorer === OWN_GOAL,
      },
      `${teamName(teamId)} の得点を追加しました。`,
    )
  }

  return (
    <AsyncForm onSubmit={submit}>
      <fieldset className="bare">
        <legend className="label">得点したチーム</legend>
        <div className="segmented">
          {sides.map((id) => (
            <label key={id}>
              <input type="radio" name="team" value={id} checked={teamId === id} onChange={() => setTeamId(id)} />
              <span>{teamName(id)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="得点者" hint="相手のオウンゴールで点が入ったときは「オウンゴール」を選んでください。">
        {(p) => (
          <select {...p} key={teamId} name="scorer" required defaultValue="">
            <option value="" disabled>選択してください</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{memberLabel(m)}</option>
            ))}
            <option value={OWN_GOAL}>オウンゴール（相手選手）</option>
          </select>
        )}
      </Field>
      {members.length === 0 && (
        <p className="hint">
          このチームのメンバーが未登録です。<a href={`#/t/${ctx.slug}/teams/${teamId}`}>メンバーを登録する</a>
        </p>
      )}
      <button type="submit" className="btn primary block">得点を追加</button>
    </AsyncForm>
  )
}

export default function MatchView({ ctx, matchId }) {
  const { t, slug, canEdit, run, requestLogin } = ctx
  const teamName = useTeamName(t.teams)
  const match = t.matches.find((m) => m.id === matchId)
  if (!match) {
    return (
      <p className="empty">
        試合が見つかりません。<a href={`#/t/${slug}/schedule`}>対戦表に戻る</a>
      </p>
    )
  }

  const goals = t.goals.filter((g) => g.match_id === match.id)
  const memberById = new Map(t.members.map((m) => [m.id, m]))
  const sides = [match.home_team_id, match.away_team_id]
  const count = (id) => goals.filter((g) => g.team_id === id).length

  const removeGoal = (g, label) => {
    if (confirm(`「${label}」の得点を取り消しますか？`)) run('delete_goal', { p_goal_id: g.id }, '得点を取り消しました。')
  }

  return (
    <article className="match-detail" aria-labelledby="match-heading">
      <p>
        <a href={`#/t/${slug}/schedule`} className="back-link">← 対戦表に戻る</a>
      </p>
      <h2 id="match-heading" className="match-heading">
        第{match.seq}試合
        <span className="muted">
          {match.court} ・ <time dateTime={match.start_at}>{formatTime(match.start_at)}</time> 開始
        </span>
      </h2>

      <div className="scoreboard card">
        <span className="team">{teamName(sides[0])}</span>
        <span className="score">
          {count(sides[0])}
          <span aria-hidden="true"> - </span>
          <span className="visually-hidden"> 対 </span>
          {count(sides[1])}
        </span>
        <span className="team">{teamName(sides[1])}</span>
        <span className={`status ${match.finished ? 'done' : ''}`}>{match.finished ? '試合終了' : '試合終了前'}</span>
      </div>

      <section className="card" aria-labelledby="goals-heading">
        <h3 id="goals-heading">得点記録</h3>
        <div className="goal-columns">
          {sides.map((side) => {
            const list = goals.filter((g) => g.team_id === side)
            return (
              <div key={side}>
                <h4>{teamName(side)}</h4>
                {list.length === 0 ? (
                  <p className="empty">得点なし</p>
                ) : (
                  <ol className="goal-list">
                    {list.map((g) => {
                      const label = g.own_goal ? 'オウンゴール' : memberLabel(memberById.get(g.member_id))
                      return (
                        <li key={g.id}>
                          <span>
                            <span aria-hidden="true">⚽ </span>
                            {label}
                          </span>
                          {canEdit && (
                            <button type="button" className="btn small danger" onClick={() => removeGoal(g, label)}
                              aria-label={`${label} の得点を取り消す`}>取消</button>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {canEdit ? (
        <>
          <section className="card" aria-labelledby="add-goal-heading">
            <h3 id="add-goal-heading">得点を入力</h3>
            <GoalForm match={match} ctx={ctx} teamName={teamName} />
          </section>
          <section className="card" aria-labelledby="finish-heading">
            <h3 id="finish-heading">試合の状態</h3>
            <p className="hint">「試合終了」にした試合だけが順位表に反映されます。</p>
            <button type="button" className={`btn block ${match.finished ? '' : 'primary'}`}
              onClick={() => run('set_match_finished', { p_match_id: match.id, p_finished: !match.finished },
                match.finished ? '試合を「試合終了前」に戻しました。' : '試合終了にしました。順位表に反映されます。')}>
              {match.finished ? '試合終了を取り消す' : '試合終了にする'}
            </button>
          </section>
        </>
      ) : (
        <p className="card login-prompt">
          得点を入力するには
          <button type="button" className="btn primary" onClick={requestLogin}>ログイン</button>
        </p>
      )}
    </article>
  )
}
