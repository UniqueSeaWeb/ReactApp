import { useEffect, useState } from 'react'

const STORAGE_KEY = 'react-todo-app:todos'

const FILTERS = {
  all: { label: 'すべて', test: () => true },
  active: { label: '未完了', test: (todo) => !todo.done },
  done: { label: '完了', test: (todo) => todo.done },
}

function loadTodos() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function App() {
  const [todos, setTodos] = useState(loadTodos)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    } catch {
      // ストレージが使えない環境では保存をスキップする
    }
  }, [todos])

  const handleSubmit = (event) => {
    event.preventDefault()
    const title = text.trim()
    if (!title) return
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }])
    setText('')
  }

  const toggleTodo = (id) =>
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)))

  const deleteTodo = (id) => setTodos((prev) => prev.filter((todo) => todo.id !== id))

  const clearDone = () => setTodos((prev) => prev.filter((todo) => !todo.done))

  const visibleTodos = todos.filter(FILTERS[filter].test)
  const remaining = todos.filter((todo) => !todo.done).length

  return (
    <>
      <header className="site-header">
        <h1>ToDo アプリ</h1>
      </header>

      <main className="container">
        <form className="add-form" onSubmit={handleSubmit}>
          <label htmlFor="new-task">新しいタスク</label>
          <div className="add-form__row">
            <input
              id="new-task"
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="例：牛乳を買う"
              maxLength={100}
              autoComplete="off"
              required
            />
            <button type="submit">追加</button>
          </div>
        </form>

        <nav aria-label="表示の切り替え">
          <ul className="filters">
            {Object.entries(FILTERS).map(([key, { label }]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="list-heading">
          <h2 id="list-heading" className="visually-hidden">
            タスク一覧
          </h2>
          {visibleTodos.length === 0 ? (
            <p className="empty">表示するタスクはありません。</p>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className={todo.done ? 'todo todo--done' : 'todo'}>
                  <label className="todo__label">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span>{todo.title}</span>
                  </label>
                  <button
                    type="button"
                    className="todo__delete"
                    onClick={() => deleteTodo(todo.id)}
                    aria-label={`「${todo.title}」を削除`}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="summary">
          <p role="status" aria-live="polite">
            残り {remaining} 件 / 全 {todos.length} 件
          </p>
          <button type="button" onClick={clearDone} disabled={todos.length === remaining}>
            完了済みを削除
          </button>
        </footer>
      </main>
    </>
  )
}

export default App
