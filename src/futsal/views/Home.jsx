import { useState } from 'react'
import { call } from '../api.js'
import { loadRecent, storeSession, tournamentUrl } from '../hooks.js'
import { formatDate } from '../format.js'
import { AsyncForm, Field, ShareButton } from '../ui.jsx'

export default function Home({ notify }) {
  const [created, setCreated] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const recent = loadRecent()

  const create = async (fd) => {
    try {
      const res = await call('create_tournament', {
        p_name: fd.get('name'),
        p_organizer: fd.get('organizer'),
        p_event_date: fd.get('date'),
        p_admin_password: fd.get('adminPw'),
        p_participant_password: fd.get('participantPw'),
      })
      // 作成者はそのまま管理者としてログイン状態にする
      storeSession(res.slug, { token: res.token, role: res.role })
      setCreated({ slug: res.slug, name: fd.get('name').trim() })
      return true
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  return (
    <main id="main" className="page home">
      <header className="hero">
        <p className="crumb">
          <a href="../">アプリ一覧</a>
        </p>
        <h1>フットサル大会メーカー</h1>
        <p>大会を作って URL を共有するだけ。対戦表の自動作成、得点入力、順位表までスマホで完結します。</p>
      </header>

      {created ? (
        <section className="card success" aria-labelledby="created-heading">
          <h2 id="created-heading">「{created.name}」を作成しました</h2>
          <p>この URL を参加者に共有してください。参加者用の合言葉も一緒に伝えてください。</p>
          <p className="url-box">
            <a href={`#/t/${created.slug}`}>{tournamentUrl(created.slug)}</a>
          </p>
          <div className="row-actions">
            <a className="btn primary" href={`#/t/${created.slug}/admin`}>大会ページを開いて準備する</a>
            <ShareButton url={tournamentUrl(created.slug)} title={created.name} notify={notify} />
          </div>
          <p className="hint">管理者パスワードは再発行できません。忘れないよう控えておいてください。</p>
        </section>
      ) : (
        <section className="card" aria-labelledby="create-heading">
          <h2 id="create-heading">新しい大会を作る</h2>
          <AsyncForm onSubmit={create}>
            <Field label="大会名" hint="ほかの大会と同じ名前は使えません（60 文字まで）">
              {(p) => <input {...p} name="name" required maxLength={60} autoComplete="off" />}
            </Field>
            <Field label="主催者">
              {(p) => <input {...p} name="organizer" required maxLength={60} autoComplete="organization" />}
            </Field>
            <Field label="開催日">
              {(p) => <input {...p} name="date" type="date" required />}
            </Field>
            <Field label="管理者パスワード" hint="8 文字以上。チーム登録や対戦表の作成に使います。">
              {(p) => (
                <input {...p} name="adminPw" type={showPw ? 'text' : 'password'} required minLength={8}
                  maxLength={72} autoComplete="new-password" />
              )}
            </Field>
            <Field label="参加者用の合言葉" hint="6 文字以上。参加者がメンバー登録や得点入力をするときに使います。管理者パスワードとは別にしてください。">
              {(p) => (
                <input {...p} name="participantPw" type={showPw ? 'text' : 'password'} required minLength={6}
                  maxLength={72} autoComplete="off" />
              )}
            </Field>
            <label className="check">
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
              パスワードと合言葉を表示する
            </label>
            <button type="submit" className="btn primary block">大会を作成して URL を発行</button>
          </AsyncForm>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card" aria-labelledby="recent-heading">
          <h2 id="recent-heading">最近開いた大会</h2>
          <ul className="link-list">
            {recent.map((t) => (
              <li key={t.slug}>
                <a href={`#/t/${t.slug}`}>
                  <span>{t.name}</span>
                  <span className="muted">{formatDate(t.event_date)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
