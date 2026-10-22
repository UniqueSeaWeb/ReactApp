import { useState } from 'react'
import { buildSchedule } from '../logic.js'
import { formatTime } from '../format.js'
import { navigate } from '../hooks.js'
import { AsyncForm, Field, ItemListEditor } from '../ui.jsx'

const MAX_COURTS = 8
const courtDefault = (i) => `${String.fromCharCode(65 + i)}コート`

function TournamentInfo({ ctx }) {
  const { t, run } = ctx
  const submit = (fd) =>
    run(
      'admin_update_tournament',
      { p_name: fd.get('name'), p_organizer: fd.get('organizer'), p_event_date: fd.get('date') },
      '大会情報を保存しました。',
    )
  return (
    <AsyncForm onSubmit={submit}>
      <Field label="大会名">
        {(p) => <input {...p} name="name" required maxLength={60} defaultValue={t.name} autoComplete="off" />}
      </Field>
      <Field label="主催者">
        {(p) => <input {...p} name="organizer" required maxLength={60} defaultValue={t.organizer} />}
      </Field>
      <Field label="開催日">
        {(p) => <input {...p} name="date" type="date" required defaultValue={t.event_date} />}
      </Field>
      <button type="submit" className="btn primary">大会情報を保存</button>
    </AsyncForm>
  )
}

function TeamManager({ ctx }) {
  const { t, run } = ctx
  const save = (team, { name }) =>
    run('admin_save_team', { p_team_id: team?.id ?? null, p_name: name }, team ? 'チーム名を修正しました。' : `${name} を登録しました。`)
  const remove = (team) => {
    if (confirm(`${team.name} を削除しますか？メンバーも削除されます。`)) {
      run('admin_delete_team', { p_team_id: team.id }, 'チームを削除しました。')
    }
  }
  return (
    <ItemListEditor items={t.teams} label="チーム名" canEdit onSave={save} onDelete={remove}
      emptyText="まだチームがありません。下のフォームから追加してください。" />
  )
}

function ScheduleBuilder({ ctx }) {
  const { t, slug, run } = ctx
  const [entry, setEntry] = useState(() => new Set(t.teams.map((x) => x.id)))
  const [form, setForm] = useState({
    start: `${t.event_date}T10:00`,
    duration: 10,
    interval: 2,
    perTeam: Math.max(1, t.teams.length - 1),
    courts: [courtDefault(0)],
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  const setCourtCount = (e) => {
    const n = Math.min(MAX_COURTS, Math.max(1, Number(e.target.value) || 1))
    setForm((f) => ({ ...f, courts: Array.from({ length: n }, (_, i) => f.courts[i] ?? courtDefault(i)) }))
  }
  const setCourtName = (i) => (e) =>
    setForm((f) => ({ ...f, courts: f.courts.map((c, j) => (j === i ? e.target.value : c)) }))
  const toggle = (id) =>
    setEntry((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // 選択順ではなく登録順に並べて組む
  const teamIds = t.teams.map((x) => x.id).filter((id) => entry.has(id))
  const maxPerTeam = Math.max(1, (teamIds.length - 1) * 2)
  const startAt = new Date(form.start)
  const valid =
    teamIds.length >= 2 && !Number.isNaN(startAt.getTime()) && form.duration >= 1 && form.interval >= 0 &&
    form.perTeam >= 1 && form.perTeam <= maxPerTeam && form.courts.every((c) => c.trim())
  const preview = valid
    ? buildSchedule({ teamIds, matchesPerTeam: form.perTeam, startAt, duration: form.duration, interval: form.interval,
        courts: form.courts.map((c) => c.trim()) })
    : []
  const lastStart = preview.at(-1)?.start_at
  const endAt = lastStart && new Date(new Date(lastStart).getTime() + form.duration * 60_000)

  const submit = async () => {
    if (!valid) return ctx.notify('エントリーは 2 チーム以上にし、入力内容を確認してください。', 'error')
    if (t.matches.length && !confirm('今の対戦表と、入力済みの得点はすべて削除されます。作り直しますか？')) return
    if (await run('admin_save_schedule', { p_matches: preview }, `対戦表を作成しました（全 ${preview.length} 試合）。`)) {
      navigate(`#/t/${slug}/schedule`)
    }
  }
  const clear = () => {
    if (confirm('対戦表と入力済みの得点をすべて削除しますか？')) run('admin_save_schedule', { p_matches: [] }, '対戦表を削除しました。')
  }

  if (t.teams.length < 2) return <p className="empty">対戦表を作るには、チームを 2 つ以上登録してください。</p>

  return (
    <AsyncForm onSubmit={submit}>
      <fieldset>
        <legend>エントリーチーム（{teamIds.length} チーム）</legend>
        <div className="check-grid">
          {t.teams.map((x) => (
            <label key={x.id} className="check">
              <input type="checkbox" checked={entry.has(x.id)} onChange={() => toggle(x.id)} />
              {x.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid-2">
        <Field label="開始日時">
          {(p) => <input {...p} type="datetime-local" required value={form.start} onChange={set('start')} />}
        </Field>
        <Field label="1 チームあたりの試合数" hint={`総当たりは ${Math.max(1, teamIds.length - 1)} 試合`}>
          {(p) => (
            <input {...p} type="number" required min="1" max={maxPerTeam} inputMode="numeric"
              value={form.perTeam} onChange={set('perTeam')} />
          )}
        </Field>
        <Field label="試合時間（分）">
          {(p) => <input {...p} type="number" required min="1" max="120" inputMode="numeric" value={form.duration} onChange={set('duration')} />}
        </Field>
        <Field label="インターバル（分）" hint="試合と試合の間の時間">
          {(p) => <input {...p} type="number" required min="0" max="120" inputMode="numeric" value={form.interval} onChange={set('interval')} />}
        </Field>
        <Field label="コート数">
          {(p) => (
            <input {...p} type="number" required min="1" max={MAX_COURTS} inputMode="numeric"
              value={form.courts.length} onChange={setCourtCount} />
          )}
        </Field>
      </div>
      <fieldset>
        <legend>コート名</legend>
        <div className="grid-2">
          {form.courts.map((c, i) => (
            <Field key={i} label={`コート ${i + 1}`}>
              {(p) => <input {...p} required maxLength={20} value={c} onChange={setCourtName(i)} />}
            </Field>
          ))}
        </div>
      </fieldset>
      <output className="preview">
        {valid
          ? `全 ${preview.length} 試合・${formatTime(form.start)} 開始 〜 ${formatTime(endAt)} 終了予定`
          : '入力内容を確認してください（エントリーは 2 チーム以上）。'}
      </output>
      <div className="row-actions">
        <button type="submit" className="btn primary">
          {t.matches.length ? '対戦表を作り直す' : '対戦表を自動作成'}
        </button>
        {t.matches.length > 0 && (
          <button type="button" className="btn danger" onClick={clear}>対戦表を削除</button>
        )}
      </div>
    </AsyncForm>
  )
}

export default function AdminView({ ctx }) {
  return (
    <div className="admin">
      <h2>大会の管理</h2>
      <section className="card" aria-labelledby="admin-teams">
        <h3 id="admin-teams">参加チーム</h3>
        <TeamManager ctx={ctx} />
      </section>
      <section className="card" aria-labelledby="admin-schedule">
        <h3 id="admin-schedule">対戦表の自動作成</h3>
        <p className="hint">全チームの試合数ができるだけ同じになり、同じチームが続けて試合しにくいように組みます。</p>
        <ScheduleBuilder key={ctx.t.teams.map((x) => x.id).join()} ctx={ctx} />
      </section>
      <section className="card" aria-labelledby="admin-info">
        <h3 id="admin-info">大会情報</h3>
        <TournamentInfo ctx={ctx} />
      </section>
    </div>
  )
}
