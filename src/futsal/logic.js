// 対戦表の自動作成と、スコア・順位の集計（UI から独立した純粋関数）

/** サークル方式で総当たりの「節」を作る。各節で全チームが 1 試合ずつ（奇数なら 1 チーム休み）。cycles 周ぶん繰り返す */
function roundRobinRounds(ids, cycles) {
  const list = ids.length % 2 ? [...ids, null] : [...ids]
  const n = list.length
  const rounds = []
  for (let c = 0; c < cycles; c++) {
    const rot = [...list]
    for (let r = 0; r < n - 1; r++) {
      const round = []
      for (let i = 0; i < n / 2; i++) {
        if (rot[i] !== null && rot[n - 1 - i] !== null) round.push([rot[i], rot[n - 1 - i]])
      }
      rounds.push(round)
      rot.splice(1, 0, rot.pop()) // 先頭を固定して残りを回転
    }
  }
  return rounds
}

/** 1 チームあたり matchesPerTeam 試合を目安に、全チームの試合数が均等になる組み合わせを選ぶ */
export function pickPairings(teamIds, matchesPerTeam) {
  const cycles = Math.ceil(matchesPerTeam / Math.max(1, teamIds.length - 1))
  const count = new Map(teamIds.map((id) => [id, 0]))
  const home = new Map(teamIds.map((id) => [id, 0]))
  const pairs = []
  for (const round of roundRobinRounds(teamIds, cycles)) {
    for (const [a, b] of round) {
      if (count.get(a) >= matchesPerTeam || count.get(b) >= matchesPerTeam) continue
      // ホーム（表記上の左側）は、これまでのホーム数が少ないほうにする
      const pair = home.get(a) <= home.get(b) ? [a, b] : [b, a]
      pairs.push(pair)
      home.set(pair[0], home.get(pair[0]) + 1)
      count.set(a, count.get(a) + 1)
      count.set(b, count.get(b) + 1)
    }
  }
  return pairs
}

/**
 * 組み合わせを時間枠×コートに割り当てる。
 * 同じ枠に同じチームは入れず、できるだけ連戦（直前の枠にも出ている）を避ける。
 */
export function buildSchedule({ teamIds, matchesPerTeam, startAt, duration, interval, courts }) {
  const pending = pickPairings(teamIds, matchesPerTeam)
  const slotMs = (duration + interval) * 60_000
  const result = []
  let prev = new Set()
  for (let slot = 0; pending.length; slot++) {
    const busy = new Set()
    const picked = []
    for (const avoidPrev of [true, false]) {
      for (let i = 0; i < pending.length && picked.length < courts.length; ) {
        const [a, b] = pending[i]
        const blocked = busy.has(a) || busy.has(b) || (avoidPrev && (prev.has(a) || prev.has(b)))
        if (blocked) {
          i++
          continue
        }
        picked.push(...pending.splice(i, 1))
        busy.add(a).add(b)
      }
    }
    const start = new Date(startAt.getTime() + slot * slotMs).toISOString()
    picked.forEach(([home, away], c) => result.push({ start_at: start, court: courts[c], home, away }))
    prev = busy
  }
  return result
}

/** 試合ごとのスコア { [matchId]: { [teamId]: 得点 } } */
export function scoresByMatch(goals) {
  const scores = {}
  for (const g of goals) {
    const s = (scores[g.match_id] ??= {})
    s[g.team_id] = (s[g.team_id] ?? 0) + 1
  }
  return scores
}

/** 同順位を考慮した順位（1, 1, 3, ...）を付ける。sameAs(a, b) が true なら同順位 */
function withRanks(sorted, sameAs) {
  return sorted.map((row, i) => {
    let j = i
    while (j > 0 && sameAs(sorted[j - 1], row)) j--
    return { ...row, rank: j + 1 }
  })
}

const POINTS = { win: 3, draw: 1, loss: 0 }

/** チーム順位。試合終了の試合だけを集計し、勝ち点 ÷ 試合数 → 得失点差 → 総得点 の順に並べる */
export function teamStandings(teams, matches, goals) {
  const scores = scoresByMatch(goals)
  const rows = new Map(
    teams.map((t) => [t.id, { team: t, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 }]),
  )
  for (const m of matches) {
    if (!m.finished) continue
    const s = scores[m.id] ?? {}
    for (const [me, op] of [
      [m.home_team_id, m.away_team_id],
      [m.away_team_id, m.home_team_id],
    ]) {
      const row = rows.get(me)
      if (!row) continue
      const gf = s[me] ?? 0
      const ga = s[op] ?? 0
      const result = gf > ga ? 'win' : gf < ga ? 'loss' : 'draw'
      row.played++
      row[result]++
      row.gf += gf
      row.ga += ga
      row.points += POINTS[result]
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, gd: r.gf - r.ga, ppg: r.played ? r.points / r.played : 0 }))
  list.sort((a, b) => b.ppg - a.ppg || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name, 'ja'))
  return withRanks(list, (a, b) => a.ppg === b.ppg && a.gd === b.gd && a.gf === b.gf)
}

/** 個人得点ランキング（通算得点。オウンゴールは含めない） */
export function scorerRanking(members, teams, goals) {
  const count = new Map()
  for (const g of goals) {
    if (!g.own_goal && g.member_id) count.set(g.member_id, (count.get(g.member_id) ?? 0) + 1)
  }
  const teamName = new Map(teams.map((t) => [t.id, t.name]))
  const list = members
    .filter((m) => count.has(m.id))
    .map((m) => ({ member: m, teamName: teamName.get(m.team_id), goals: count.get(m.id) }))
    .sort((a, b) => b.goals - a.goals || a.member.name.localeCompare(b.member.name, 'ja'))
  return withRanks(list, (a, b) => a.goals === b.goals)
}
