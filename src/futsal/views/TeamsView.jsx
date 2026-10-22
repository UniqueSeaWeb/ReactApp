import { navigate } from '../hooks.js'
import { Field, ItemListEditor } from '../ui.jsx'

export default function TeamsView({ ctx, teamId }) {
  const { t, slug, canEdit, run, requestLogin } = ctx
  const team = t.teams.find((x) => x.id === teamId)

  if (t.teams.length === 0) {
    return <p className="empty">チームがまだ登録されていません。主催者の登録をお待ちください。</p>
  }

  const members = team ? t.members.filter((m) => m.team_id === team.id) : []
  const save = (member, { name, number }) =>
    run(
      'save_member',
      { p_team_id: team.id, p_member_id: member?.id ?? null, p_name: name, p_number: number },
      member ? 'メンバーを修正しました。' : `${name} を登録しました。`,
    )
  const remove = (member) => {
    if (confirm(`${member.name} を削除しますか？（記録済みの得点は「削除された選手」として残ります）`)) {
      run('delete_member', { p_member_id: member.id }, 'メンバーを削除しました。')
    }
  }

  return (
    <section aria-labelledby="teams-heading">
      <h2 id="teams-heading">チームとメンバー</h2>
      <Field label="チームを選択">
        {(p) => (
          <select {...p} value={team?.id ?? ''} onChange={(e) => navigate(`#/t/${slug}/teams/${e.target.value}`)}>
            <option value="" disabled>自分のチームを選んでください</option>
            {t.teams.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        )}
      </Field>

      {team && (
        <section className="card" aria-labelledby="members-heading">
          <h3 id="members-heading">
            {team.name} のメンバー <span className="muted">{members.length} 人</span>
          </h3>
          <ItemListEditor
            items={members}
            label="選手名"
            withNumber
            canEdit={canEdit}
            onSave={save}
            onDelete={remove}
            emptyText="メンバーが登録されていません。"
          />
          {!canEdit && (
            <p className="login-prompt">
              メンバーを登録・修正するには
              <button type="button" className="btn primary" onClick={requestLogin}>ログイン</button>
            </p>
          )}
        </section>
      )}
    </section>
  )
}
