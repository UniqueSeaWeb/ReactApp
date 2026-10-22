// デモモード用バックエンド。supabase/schema.sql の RPC を localStorage 上で簡易再現する。
// データはこの端末のブラウザにだけ保存される（他の人とは共有されない）。

const KEY = 'futsal-demo-db'

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { tournaments: [], sessions: {} }
  } catch {
    return { tournaments: [], sessions: {} }
  }
}
const save = (db) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // 保存できない環境（プライベートモードなど）ではメモリ上だけで動かす
  }
}

const fail = (code) => {
  throw Object.assign(new Error(code), { code })
}
const clean = (s) => String(s ?? '').trim()
const normName = (s) => clean(s).normalize('NFKC').toLowerCase()
const randomId = () => crypto.randomUUID()
const hash = async (text) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')

function issue(db, slug, role) {
  const token = randomId()
  db.sessions[token] = { slug, role }
  return { token, role }
}

function auth(db, token, role = 'participant') {
  const s = db.sessions[token]
  if (!s || (role === 'admin' && s.role !== 'admin')) fail('UNAUTHORIZED')
  return db.tournaments.find((t) => t.slug === s.slug)
}

const findIn = (list, id) => list.find((x) => x.id === id) ?? fail('NOT_FOUND')

const handlers = {
  async create_tournament(db, a) {
    if (!clean(a.p_name) || !clean(a.p_organizer) || !a.p_event_date) fail('INVALID_INPUT')
    if (a.p_admin_password === a.p_participant_password) fail('SAME_PASSWORD')
    if (db.tournaments.some((t) => normName(t.name) === normName(a.p_name))) fail('NAME_TAKEN')
    const slug = randomId().replaceAll('-', '').slice(0, 12)
    db.tournaments.push({
      slug,
      name: clean(a.p_name),
      organizer: clean(a.p_organizer),
      event_date: a.p_event_date,
      adminHash: await hash(a.p_admin_password),
      participantHash: await hash(a.p_participant_password),
      teams: [],
      members: [],
      matches: [],
      goals: [],
    })
    return { ...issue(db, slug, 'admin'), slug }
  },
  async login(db, a) {
    const t = db.tournaments.find((x) => x.slug === a.p_slug) ?? fail('NOT_FOUND')
    const h = await hash(a.p_password ?? '')
    if (h === t.adminHash) return issue(db, t.slug, 'admin')
    if (h === t.participantHash) return issue(db, t.slug, 'participant')
    return { error: 'INVALID_PASSWORD' }
  },
  logout(db, a) {
    delete db.sessions[a.p_token]
  },
  get_tournament(db, a) {
    const t = db.tournaments.find((x) => x.slug === a.p_slug)
    if (!t) return null
    const { slug, name, organizer, event_date, teams, members, matches, goals } = t
    return { slug, name, organizer, event_date, teams, members, matches, goals }
  },
  admin_update_tournament(db, a) {
    const t = auth(db, a.p_token, 'admin')
    if (db.tournaments.some((x) => x !== t && normName(x.name) === normName(a.p_name))) fail('NAME_TAKEN')
    Object.assign(t, { name: clean(a.p_name), organizer: clean(a.p_organizer), event_date: a.p_event_date })
  },
  admin_save_team(db, a) {
    const t = auth(db, a.p_token, 'admin')
    if (t.teams.some((x) => x.id !== a.p_team_id && normName(x.name) === normName(a.p_name))) fail('TEAM_NAME_TAKEN')
    if (a.p_team_id) findIn(t.teams, a.p_team_id).name = clean(a.p_name)
    else t.teams.push({ id: randomId(), name: clean(a.p_name) })
  },
  admin_delete_team(db, a) {
    const t = auth(db, a.p_token, 'admin')
    if (t.matches.some((m) => [m.home_team_id, m.away_team_id].includes(a.p_team_id))) fail('TEAM_IN_SCHEDULE')
    t.teams = t.teams.filter((x) => x.id !== a.p_team_id)
    t.members = t.members.filter((m) => m.team_id !== a.p_team_id)
  },
  admin_save_schedule(db, a) {
    const t = auth(db, a.p_token, 'admin')
    t.matches = a.p_matches.map((m, i) => ({
      id: randomId(),
      seq: i + 1,
      start_at: m.start_at,
      court: m.court,
      home_team_id: m.home,
      away_team_id: m.away,
      finished: false,
    }))
    t.goals = []
  },
  save_member(db, a) {
    const t = auth(db, a.p_token)
    findIn(t.teams, a.p_team_id)
    const fields = { name: clean(a.p_name), number: a.p_number }
    if (a.p_member_id) Object.assign(findIn(t.members, a.p_member_id), fields)
    else t.members.push({ id: randomId(), team_id: a.p_team_id, ...fields })
  },
  delete_member(db, a) {
    const t = auth(db, a.p_token)
    t.members = t.members.filter((m) => m.id !== a.p_member_id)
    t.goals.forEach((g) => g.member_id === a.p_member_id && (g.member_id = null))
  },
  add_goal(db, a) {
    const t = auth(db, a.p_token)
    findIn(t.matches, a.p_match_id)
    t.goals.push({
      id: randomId(),
      match_id: a.p_match_id,
      team_id: a.p_team_id,
      member_id: a.p_own_goal ? null : a.p_member_id,
      own_goal: a.p_own_goal,
    })
  },
  delete_goal(db, a) {
    const t = auth(db, a.p_token)
    t.goals = t.goals.filter((g) => g.id !== a.p_goal_id)
  },
  set_match_finished(db, a) {
    const t = auth(db, a.p_token)
    findIn(t.matches, a.p_match_id).finished = a.p_finished
  },
}

export async function call(fn, args) {
  const db = load()
  try {
    const result = await handlers[fn](db, args)
    save(db)
    // 本物の API と同じく、呼び出し側でデータを書き換えても保存内容に影響しないよう複製して返す
    return result === undefined ? null : structuredClone(result)
  } catch (e) {
    if (e.code) return { error: e.code }
    throw e
  }
}
