import { useEffect, useId, useRef, useState } from 'react'
import { memberLabel } from './format.js'

// ---- モーダルダイアログ（ネイティブの <dialog> を showModal で開き、Esc や戻る操作で閉じられる）

export function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose} closedby="any">
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>
      {open && children}
    </dialog>
  )
}

// ---- 入力欄（ラベル・補足を上に置き、モバイルのキーボードやオートコンプリートに隠れないようにする）

export function Field({ label, hint, children, optional }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional">任意</span>}
      </label>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {children({ id, 'aria-describedby': hintId })}
    </div>
  )
}

// ---- 送信中の二重送信を防ぐフォーム。onSubmit が true を返したら reset する

export function AsyncForm({ onSubmit, children, className = 'stack' }) {
  const [busy, setBusy] = useState(false)
  const handle = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(true)
    try {
      if ((await onSubmit(new FormData(form), form)) === true) form.reset()
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className={className} onSubmit={handle} aria-busy={busy}>
      <fieldset disabled={busy} className="bare">
        {children}
      </fieldset>
    </form>
  )
}

// ---- 名前（＋任意で背番号）のリストを追加・修正・削除する部品。チームとメンバーで共用

function ItemForm({ initial, withNumber, submitLabel, onSubmit, onCancel, nameLabel }) {
  const submit = async (fd) => {
    const num = fd.get('number')
    return onSubmit({ name: fd.get('name'), number: num === null || num === '' ? null : Number(num) })
  }
  return (
    <AsyncForm onSubmit={submit} className="item-form">
      {withNumber && (
        <Field label="背番号" optional>
          {(p) => (
            <input {...p} name="number" type="number" min="0" max="999" inputMode="numeric"
              defaultValue={initial?.number ?? ''} className="num-input" />
          )}
        </Field>
      )}
      <Field label={nameLabel}>
        {(p) => (
          <input {...p} name="name" required maxLength={40} autoComplete="off"
            defaultValue={initial?.name ?? ''} autoFocus={!!initial} enterKeyHint="done" />
        )}
      </Field>
      <div className="row-actions">
        <button type="submit" className="btn primary">{submitLabel}</button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>キャンセル</button>
        )}
      </div>
    </AsyncForm>
  )
}

export function ItemListEditor({ items, label, canEdit, withNumber, onSave, onDelete, emptyText }) {
  const [editingId, setEditingId] = useState(null)
  return (
    <>
      {items.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <ul className="item-list">
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id} className="editing">
                <ItemForm initial={item} withNumber={withNumber} nameLabel={label} submitLabel="保存"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (v) => (await onSave(item, v)) && setEditingId(null)} />
              </li>
            ) : (
              <li key={item.id}>
                <span className="item-name">{withNumber ? memberLabel(item) : item.name}</span>
                {canEdit && (
                  <span className="row-actions">
                    <button type="button" className="btn small" onClick={() => setEditingId(item.id)}
                      aria-label={`${item.name} を修正`}>修正</button>
                    <button type="button" className="btn small danger" onClick={() => onDelete(item)}
                      aria-label={`${item.name} を削除`}>削除</button>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {canEdit && (
        <div className="add-box">
          <h3 className="sub-heading">{label}を追加</h3>
          <ItemForm withNumber={withNumber} nameLabel={label} submitLabel="追加" onSubmit={(v) => onSave(null, v)} />
        </div>
      )}
    </>
  )
}

// ---- 共有（スマホは共有シート、PC はクリップボードへコピー）

export function ShareButton({ url, title, notify }) {
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // キャンセルされた場合は何もしない
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      notify('大会の URL をコピーしました。')
    } catch {
      notify('コピーできませんでした。URL を長押しまたは選択してコピーしてください。', 'error')
    }
  }
  return (
    <button type="button" className="btn" onClick={share}>
      URL を共有
    </button>
  )
}
