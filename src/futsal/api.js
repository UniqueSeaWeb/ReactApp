// バックエンド呼び出し。Supabase（PostgREST の RPC）を使い、未設定ならこの端末だけのデモモードで動く。
// 関数名・引数は supabase/schema.sql の RPC と同じ。

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY

export const ERROR_MESSAGES = {
  NAME_TAKEN: 'その大会名はすでに使われています。別の名前にしてください。',
  TEAM_NAME_TAKEN: '同じ名前のチームがすでにあります。',
  SAME_PASSWORD: '管理者パスワードと参加者用合言葉は別のものにしてください。',
  INVALID_INPUT: '入力内容を確認してください。',
  INVALID_PASSWORD: 'パスワードが違います。',
  LOCKED: 'ログインの失敗が続いたため、15 分ほど待ってからお試しください。',
  UNAUTHORIZED: 'ログインの有効期限が切れました。もう一度ログインしてください。',
  NOT_FOUND: '対象が見つかりません。画面を更新してください。',
  TEAM_IN_SCHEDULE: '対戦表に含まれるチームは削除できません。先に対戦表を作り直してください。',
  LIMIT_EXCEEDED: '登録できる上限に達しました。',
  NETWORK: '通信に失敗しました。電波の良い場所でもう一度お試しください。',
}

export class ApiError extends Error {
  constructor(code) {
    super(ERROR_MESSAGES[code] ?? '予期しないエラーが発生しました。')
    this.code = code
  }
}

async function callSupabase(fn, args) {
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
  } catch {
    throw new ApiError('NETWORK')
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.message)
  return body
}

export async function call(fn, args) {
  const result = await (isDemo ? (await import('./demoBackend.js')).call : callSupabase)(fn, args)
  if (result?.error) throw new ApiError(result.error)
  return result
}
