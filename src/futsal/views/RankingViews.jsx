import { useMemo } from 'react'
import { scorerRanking, teamStandings } from '../logic.js'
import { memberLabel } from '../format.js'

// 横に長い表はスマホでは枠内で横スクロールさせる（キーボードでもスクロールできるよう tabIndex を付ける）
function TableWrap({ label, children }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table>{children}</table>
    </div>
  )
}

export function StandingsView({ ctx }) {
  const { t } = ctx
  const rows = useMemo(() => teamStandings(t.teams, t.matches, t.goals), [t])
  return (
    <section aria-labelledby="standings-heading">
      <h2 id="standings-heading">チーム順位</h2>
      <p className="hint">
        ポイント ＝ 勝ち点 ÷ 試合数（勝ち 3・引き分け 1・負け 0）。同ポイントは得失点差、総得点の順で並べます。「試合終了」の試合のみ集計します。
      </p>
      {rows.length === 0 ? (
        <p className="empty">チームが登録されていません。</p>
      ) : (
        <TableWrap label="チーム順位表">
          <thead>
            <tr>
              <th scope="col">順位</th>
              <th scope="col" className="name-col">チーム</th>
              <th scope="col"><abbr title="ポイント（勝ち点 ÷ 試合数）">Pt</abbr></th>
              <th scope="col">試合</th>
              <th scope="col">勝</th>
              <th scope="col">分</th>
              <th scope="col">敗</th>
              <th scope="col">勝ち点</th>
              <th scope="col">得点</th>
              <th scope="col">失点</th>
              <th scope="col">差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id}>
                <td className="rank">{r.rank}</td>
                <th scope="row" className="name-col">
                  <a href={`#/t/${ctx.slug}/teams/${r.team.id}`}>{r.team.name}</a>
                </th>
                <td className="strong">{r.played ? r.ppg.toFixed(2) : '-'}</td>
                <td>{r.played}</td>
                <td>{r.win}</td>
                <td>{r.draw}</td>
                <td>{r.loss}</td>
                <td>{r.points}</td>
                <td>{r.gf}</td>
                <td>{r.ga}</td>
                <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </section>
  )
}

export function ScorersView({ ctx }) {
  const { t } = ctx
  const rows = useMemo(() => scorerRanking(t.members, t.teams, t.goals), [t])
  return (
    <section aria-labelledby="scorers-heading">
      <h2 id="scorers-heading">個人得点ランキング</h2>
      <p className="hint">大会を通した通算得点です。オウンゴールは含みません。</p>
      {rows.length === 0 ? (
        <p className="empty">まだ得点が記録されていません。</p>
      ) : (
        <TableWrap label="個人得点ランキング">
          <thead>
            <tr>
              <th scope="col">順位</th>
              <th scope="col" className="name-col">選手</th>
              <th scope="col">チーム</th>
              <th scope="col">得点</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id}>
                <td className="rank">{r.rank}</td>
                <th scope="row" className="name-col">{memberLabel(r.member)}</th>
                <td>{r.teamName}</td>
                <td className="strong">{r.goals}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </section>
  )
}
