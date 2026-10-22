-- =====================================================================
-- フットサル大会アプリ（/futsal/）用 Supabase スキーマ
--
-- 方針
--   * テーブルは anon / authenticated から一切直接触れない（REVOKE + RLS 有効・ポリシーなし）
--   * 読み書きはすべて SECURITY DEFINER の RPC 関数経由。関数内で入力検証と権限確認を行う
--   * パスワードは bcrypt（pgcrypto の crypt）でハッシュ化して保存し、平文は保存しない
--   * ログイン成功時にランダムなセッショントークンを発行（DB には SHA-256 のみ保存、12 時間で失効）
--   * ログイン失敗は大会ごとに 15 分 10 回までに制限（総当たり対策）
--
-- 使い方: Supabase の SQL Editor にこのファイルを貼り付けて実行する（再実行可能）
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[A-Za-z0-9_-]{12}$'),
  name        text not null check (char_length(name) between 1 and 60),
  organizer   text not null check (char_length(organizer) between 1 and 60),
  event_date  date not null,
  created_at  timestamptz not null default now()
);
-- 大会名は全角半角・大文字小文字の違いを無視して重複不可
create unique index if not exists tournaments_name_uniq
  on public.tournaments (lower(normalize(name, NFKC)));

create table if not exists public.tournament_secrets (
  tournament_id    uuid primary key references public.tournaments on delete cascade,
  admin_hash       text not null,
  participant_hash text not null
);

create table if not exists public.sessions (
  token_hash    bytea primary key,
  tournament_id uuid not null references public.tournaments on delete cascade,
  role          text not null check (role in ('admin', 'participant')),
  expires_at    timestamptz not null
);

create table if not exists public.login_failures (
  id            bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments on delete cascade,
  failed_at     timestamptz not null default now()
);
create index if not exists login_failures_idx on public.login_failures (tournament_id, failed_at);

create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  created_at    timestamptz not null default now()
);
create unique index if not exists teams_name_uniq
  on public.teams (tournament_id, lower(normalize(name, NFKC)));

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  number     smallint check (number between 0 and 999),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments on delete cascade,
  seq           int not null,
  start_at      timestamptz not null,
  court         text not null check (char_length(court) between 1 and 20),
  home_team_id  uuid not null references public.teams on delete cascade,
  away_team_id  uuid not null references public.teams on delete cascade,
  finished      boolean not null default false,
  check (home_team_id <> away_team_id)
);
create index if not exists matches_tournament_idx on public.matches (tournament_id, seq);

-- team_id は「得点が入ったチーム」。オウンゴールは加点側チームで登録し member_id は持たない
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches on delete cascade,
  team_id    uuid not null references public.teams on delete cascade,
  member_id  uuid references public.members on delete set null,
  own_goal   boolean not null default false,
  created_at timestamptz not null default now(),
  check (not (own_goal and member_id is not null))
);
create index if not exists goals_match_idx on public.goals (match_id);

-- テーブルへの直接アクセスを完全に遮断
alter table public.tournaments        enable row level security;
alter table public.tournament_secrets enable row level security;
alter table public.sessions           enable row level security;
alter table public.login_failures     enable row level security;
alter table public.teams              enable row level security;
alter table public.members            enable row level security;
alter table public.matches            enable row level security;
alter table public.goals              enable row level security;
revoke all on all tables in schema public from public;
do $$ begin
  if exists (select from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------- helpers

-- 前後の空白を除き、空なら NULL
create or replace function public._clean(p text) returns text
language sql immutable as $$ select nullif(btrim(p), '') $$;

-- トークンを検証して大会 ID を返す。p_role = 'admin' なら管理者のみ許可
create or replace function public._auth(p_token text, p_role text default 'participant')
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v record;
begin
  select tournament_id, role into v from sessions
   where token_hash = digest(coalesce(p_token, ''), 'sha256') and expires_at > now();
  if not found or (p_role = 'admin' and v.role <> 'admin') then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  return v.tournament_id;
end $$;

create or replace function public._issue_session(p_tournament uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
begin
  delete from sessions where expires_at < now();
  insert into sessions (token_hash, tournament_id, role, expires_at)
  values (digest(v_token, 'sha256'), p_tournament, p_role, now() + interval '12 hours');
  return jsonb_build_object('token', v_token, 'role', p_role);
end $$;

create or replace function public._check_team(p_tournament uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select from teams where id = p_team and tournament_id = p_tournament) then
    raise exception 'NOT_FOUND';
  end if;
end $$;

-- ---------------------------------------------------------------- public API

create or replace function public.create_tournament(
  p_name text, p_organizer text, p_event_date date,
  p_admin_password text, p_participant_password text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id   uuid;
  v_slug text;
begin
  if _clean(p_name) is null or char_length(_clean(p_name)) > 60
     or _clean(p_organizer) is null or char_length(_clean(p_organizer)) > 60
     or p_event_date is null
     or char_length(coalesce(p_admin_password, '')) not between 8 and 72
     or char_length(coalesce(p_participant_password, '')) not between 6 and 72 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_admin_password = p_participant_password then
    raise exception 'SAME_PASSWORD';
  end if;
  loop
    v_slug := translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');
    exit when not exists (select from tournaments where slug = v_slug);
  end loop;
  begin
    insert into tournaments (slug, name, organizer, event_date)
    values (v_slug, _clean(p_name), _clean(p_organizer), p_event_date)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;
  insert into tournament_secrets values (
    v_id, crypt(p_admin_password, gen_salt('bf', 10)), crypt(p_participant_password, gen_salt('bf', 10)));
  return _issue_session(v_id, 'admin') || jsonb_build_object('slug', v_slug);
end $$;

-- 失敗時は例外ではなく JSON を返す（例外だと失敗記録がロールバックされるため）
create or replace function public.login(p_slug text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_s  tournament_secrets;
begin
  select id into v_id from tournaments where slug = p_slug;
  if not found then raise exception 'NOT_FOUND'; end if;
  delete from login_failures where failed_at < now() - interval '1 day';
  if (select count(*) from login_failures
       where tournament_id = v_id and failed_at > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('error', 'LOCKED');
  end if;
  select * into v_s from tournament_secrets where tournament_id = v_id;
  if v_s.admin_hash = crypt(coalesce(p_password, ''), v_s.admin_hash) then
    return _issue_session(v_id, 'admin');
  elsif v_s.participant_hash = crypt(coalesce(p_password, ''), v_s.participant_hash) then
    return _issue_session(v_id, 'participant');
  end if;
  insert into login_failures (tournament_id) values (v_id);
  return jsonb_build_object('error', 'INVALID_PASSWORD');
end $$;

create or replace function public.logout(p_token text)
returns void language sql security definer set search_path = public, extensions as $$
  delete from sessions where token_hash = digest(coalesce(p_token, ''), 'sha256');
$$;

create or replace function public.get_tournament(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', t.slug, 'name', t.name, 'organizer', t.organizer, 'event_date', t.event_date,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by created_at)
                         from teams where tournament_id = t.id), '[]'),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'team_id', m.team_id, 'name', m.name,
                                                             'number', m.number) order by m.number nulls last, m.created_at)
                           from members m join teams tm on tm.id = m.team_id where tm.tournament_id = t.id), '[]'),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'seq', seq, 'start_at', start_at, 'court', court,
                                                             'home_team_id', home_team_id, 'away_team_id', away_team_id,
                                                             'finished', finished) order by seq)
                           from matches where tournament_id = t.id), '[]'),
    'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'match_id', g.match_id, 'team_id', g.team_id,
                                                           'member_id', g.member_id, 'own_goal', g.own_goal) order by g.created_at)
                         from goals g join matches mt on mt.id = g.match_id where mt.tournament_id = t.id), '[]')
  ) from tournaments t where t.slug = p_slug;
$$;

-- ---- 管理者のみ

create or replace function public.admin_update_tournament(
  p_token text, p_name text, p_organizer text, p_event_date date
) returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token, 'admin');
begin
  if _clean(p_name) is null or _clean(p_organizer) is null or p_event_date is null then
    raise exception 'INVALID_INPUT';
  end if;
  update tournaments set name = _clean(p_name), organizer = _clean(p_organizer), event_date = p_event_date
   where id = v_tid;
exception when unique_violation then
  raise exception 'NAME_TAKEN';
end $$;

create or replace function public.admin_save_team(p_token text, p_team_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token, 'admin');
begin
  if _clean(p_name) is null then raise exception 'INVALID_INPUT'; end if;
  if p_team_id is null then
    if (select count(*) from teams where tournament_id = v_tid) >= 64 then raise exception 'LIMIT_EXCEEDED'; end if;
    insert into teams (tournament_id, name) values (v_tid, _clean(p_name));
  else
    perform _check_team(v_tid, p_team_id);
    update teams set name = _clean(p_name) where id = p_team_id;
  end if;
exception when unique_violation then
  raise exception 'TEAM_NAME_TAKEN';
end $$;

create or replace function public.admin_delete_team(p_token text, p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token, 'admin');
begin
  perform _check_team(v_tid, p_team_id);
  if exists (select from matches where p_team_id in (home_team_id, away_team_id)) then
    raise exception 'TEAM_IN_SCHEDULE';
  end if;
  delete from teams where id = p_team_id;
end $$;

-- p_matches: [{ "start_at": ISO8601, "court": text, "home": uuid, "away": uuid }, ...]
-- 既存の対戦表（と得点）を置き換える。空配列なら対戦表を削除
create or replace function public.admin_save_schedule(p_token text, p_matches jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token, 'admin');
begin
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if exists (
    select from jsonb_array_elements(p_matches) e
     where _clean(e->>'court') is null or char_length(e->>'court') > 20
        or (e->>'home') = (e->>'away')
        or not exists (select from teams where id = (e->>'home')::uuid and tournament_id = v_tid)
        or not exists (select from teams where id = (e->>'away')::uuid and tournament_id = v_tid)
  ) then
    raise exception 'INVALID_INPUT';
  end if;
  delete from matches where tournament_id = v_tid;
  insert into matches (tournament_id, seq, start_at, court, home_team_id, away_team_id)
  select v_tid, e.ord, (e.v->>'start_at')::timestamptz, _clean(e.v->>'court'), (e.v->>'home')::uuid, (e.v->>'away')::uuid
    from jsonb_array_elements(p_matches) with ordinality as e(v, ord);
end $$;

-- ---- 参加者（管理者も可）

create or replace function public.save_member(
  p_token text, p_team_id uuid, p_member_id uuid, p_name text, p_number int
) returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token);
begin
  perform _check_team(v_tid, p_team_id);
  if _clean(p_name) is null or char_length(_clean(p_name)) > 40 or p_number not between 0 and 999 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_member_id is null then
    if (select count(*) from members where team_id = p_team_id) >= 50 then raise exception 'LIMIT_EXCEEDED'; end if;
    insert into members (team_id, name, number) values (p_team_id, _clean(p_name), p_number);
  else
    update members set name = _clean(p_name), number = p_number where id = p_member_id and team_id = p_team_id;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
end $$;

create or replace function public.delete_member(p_token text, p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token);
begin
  delete from members m using teams t
   where m.id = p_member_id and t.id = m.team_id and t.tournament_id = v_tid;
end $$;

create or replace function public.add_goal(
  p_token text, p_match_id uuid, p_team_id uuid, p_member_id uuid, p_own_goal boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := _auth(p_token);
  v_m   matches;
begin
  select * into v_m from matches where id = p_match_id and tournament_id = v_tid;
  if not found or p_team_id not in (v_m.home_team_id, v_m.away_team_id) then
    raise exception 'NOT_FOUND';
  end if;
  if (select count(*) from goals where match_id = p_match_id) >= 100 then raise exception 'LIMIT_EXCEEDED'; end if;
  -- 通常の得点は加点チームの選手、オウンゴールは選手なし
  if coalesce(p_own_goal, false) then
    p_member_id := null;
  elsif not exists (select from members where id = p_member_id and team_id = p_team_id) then
    raise exception 'INVALID_INPUT';
  end if;
  insert into goals (match_id, team_id, member_id, own_goal)
  values (p_match_id, p_team_id, p_member_id, coalesce(p_own_goal, false));
end $$;

create or replace function public.delete_goal(p_token text, p_goal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token);
begin
  delete from goals g using matches m
   where g.id = p_goal_id and m.id = g.match_id and m.tournament_id = v_tid;
end $$;

create or replace function public.set_match_finished(p_token text, p_match_id uuid, p_finished boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_tid uuid := _auth(p_token);
begin
  update matches set finished = coalesce(p_finished, false) where id = p_match_id and tournament_id = v_tid;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- ---------------------------------------------------------------- grants

revoke execute on all functions in schema public from public;
do $$
declare f text;
begin
  if not exists (select from pg_roles where rolname = 'anon') then return; end if;
  execute 'revoke execute on all functions in schema public from anon, authenticated';
  foreach f in array array[
    'create_tournament(text,text,date,text,text)', 'login(text,text)', 'logout(text)', 'get_tournament(text)',
    'admin_update_tournament(text,text,text,date)', 'admin_save_team(text,uuid,text)',
    'admin_delete_team(text,uuid)', 'admin_save_schedule(text,jsonb)',
    'save_member(text,uuid,uuid,text,int)', 'delete_member(text,uuid)',
    'add_goal(text,uuid,uuid,uuid,boolean)', 'delete_goal(text,uuid)', 'set_match_finished(text,uuid,boolean)'
  ] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
