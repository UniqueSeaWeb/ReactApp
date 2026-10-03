import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'react-todo-app:todos'

const FILTERS = {
  all: { label: 'すべて', test: () => true },
  active: { label: '未完了', test: (todo) => !todo.done },
  done: { label: '完了', test: (todo) => todo.done },
}

const EMPTY_MESSAGES = {
  all: {
    title: 'まだタスクはありません',
    body: '上の入力欄から、最初のタスクを追加しましょう。',
  },
  active: {
    title: '未完了のタスクはありません',
    body: 'すべて片付きました。おつかれさまでした。',
  },
  done: {
    title: '完了したタスクはありません',
    body: 'タスクのチェックボックスを押すと、ここに並びます。',
  },
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

function loadTodos() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function Icon({ name }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    trash: (
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    ),
    list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  }
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

function App() {
  const [todos, setTodos] = useState(loadTodos)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('all')
  const [lastDeleted, setLastDeleted] = useState(null)
  const [today] = useState(() => dateFormatter.format(new Date()))
  const inputRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    } catch {
      // ストレージが使えない環境では保存をスキップする
    }
  }, [todos])

  // 「元に戻す」は一定時間で消す
  useEffect(() => {
    if (!lastDeleted) return undefined
    const timer = setTimeout(() => setLastDeleted(null), 6000)
    return () => clearTimeout(timer)
  }, [lastDeleted])

  const handleSubmit = (event) => {
    event.preventDefault()
    const title = text.trim()
    if (!title) return
    setTodos((prev) => [{ id: crypto.randomUUID(), title, done: false }, ...prev])
    setText('')
    if (filter === 'done') setFilter('all')
  }

  const toggleTodo = (id) =>
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)))

  const deleteTodo = (id) => {
    const index = todos.findIndex((todo) => todo.id === id)
    if (index === -1) return
    setLastDeleted({ todos: [todos[index]], indexes: [index] })
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
  }

  const clearDone = () => {
    const removed = []
    const indexes = []
    todos.forEach((todo, index) => {
      if (todo.done) {
        removed.push(todo)
        indexes.push(index)
      }
    })
    if (removed.length === 0) return
    setLastDeleted({ todos: removed, indexes })
    setTodos((prev) => prev.filter((todo) => !todo.done))
  }

  const undoDelete = () => {
    if (!lastDeleted) return
    setTodos((prev) => {
      const next = [...prev]
      lastDeleted.indexes.forEach((index, i) => next.splice(index, 0, lastDeleted.todos[i]))
      return next
    })
    setLastDeleted(null)
  }

  const counts = {
    all: todos.length,
    active: todos.filter((todo) => !todo.done).length,
    done: todos.filter((todo) => todo.done).length,
  }
  const progress = counts.all === 0 ? 0 : Math.round((counts.done / counts.all) * 100)
  const visibleTodos = todos.filter(FILTERS[filter].test)
  const empty = EMPTY_MESSAGES[filter]

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <p className="brand">
            <span className="brand__mark">
              <Icon name="check" />
            </span>
            ToDo
          </p>
          <p className="today">{today}</p>
        </div>
      </header>

      <main className="container">
        <section className="hero" aria-labelledby="page-title">
          <h1 id="page-title">やること</h1>
          <div className="progress">
            <p className="progress__text">
              <span className="progress__done">{counts.done}</span>
              <span className="progress__total"> / {counts.all} 件完了</span>
            </p>
            <progress className="progress__bar" max={100} value={progress} aria-label="完了の割合">
              {progress}%
            </progress>
          </div>
        </section>

        <form className="add-form" onSubmit={handleSubmit}>
          <label htmlFor="new-task" className="add-form__label">
            新しいタスク
          </label>
          <div className="add-form__row">
            <input
              ref={inputRef}
              id="new-task"
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="例：牛乳を買う"
              maxLength={100}
              autoComplete="off"
              enterKeyHint="done"
              required
            />
            <button type="submit" className="button button--primary">
              <Icon name="plus" />
              追加
            </button>
          </div>
        </form>

        <section className="panel" aria-labelledby="list-heading">
          <div className="panel__header">
            <h2 id="list-heading" className="visually-hidden">
              タスク一覧
            </h2>
            <nav aria-label="表示の切り替え">
              <ul className="filters">
                {Object.entries(FILTERS).map(([key, { label }]) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="filter"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                      <span className="filter__count">{counts[key]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {visibleTodos.length === 0 ? (
            <div className="empty">
              <span className="empty__icon">
                <Icon name="list" />
              </span>
              <p className="empty__title">{empty.title}</p>
              <p className="empty__body">{empty.body}</p>
              {filter === 'all' && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => inputRef.current?.focus()}
                >
                  タスクを入力する
                </button>
              )}
            </div>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className={todo.done ? 'todo todo--done' : 'todo'}>
                  <label className="todo__label">
                    <input
                      type="checkbox"
                      className="todo__check"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span className="todo__title">{todo.title}</span>
                  </label>
                  <button
                    type="button"
                    className="icon-button todo__delete"
                    onClick={() => deleteTodo(todo.id)}
                    aria-label={`「${todo.title}」を削除`}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="panel__footer">
            <p>残り {counts.active} 件</p>
            <button
              type="button"
              className="button button--ghost"
              onClick={clearDone}
              disabled={counts.done === 0}
            >
              完了済みを削除
            </button>
          </div>
        </section>

        <p className="note">
          タスクはこのブラウザの中だけに保存されます。
          <br />
          <a href="solar/">3D の太陽系ビューアも見る</a>
        </p>
      </main>

      <div className="toast-region" role="status" aria-live="polite">
        {lastDeleted && (
          <div className="toast">
            <span>
              {lastDeleted.todos.length === 1
                ? 'タスクを削除しました'
                : `${lastDeleted.todos.length} 件のタスクを削除しました`}
            </span>
            <button type="button" className="toast__action" onClick={undoDelete}>
              元に戻す
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default App
