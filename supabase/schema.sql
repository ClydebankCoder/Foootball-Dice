-- Football Dice — Supabase schema.
--
-- Not required to play the MVP (the game runs entirely locally without it),
-- but this is the shape the local types already follow, so persistence is a
-- matter of reading and writing these tables rather than reshaping the app.
--
-- Apply with:  supabase db execute --file supabase/schema.sql
-- or paste into the SQL editor in the Supabase dashboard.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ clubs */

create table if not exists public.clubs (
  id           text primary key,
  name         text not null,
  short_name   text not null,
  abbreviation text not null,
  stadium      text,
  league       text not null default 'premiership',
  attack       smallint not null check (attack between 1 and 100),
  midfield     smallint not null check (midfield between 1 and 100),
  defence      smallint not null check (defence between 1 and 100),
  goalkeeper   smallint not null check (goalkeeper between 1 and 100),
  created_at   timestamptz not null default now()
);

/* ---------------------------------------------------------------- players */

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  club_id       text not null references public.clubs (id) on delete cascade,
  name          text not null,
  age           smallint not null check (age between 15 and 45),
  position      text not null check (position in ('GK', 'DEF', 'MID', 'ATT')),
  squad_number  smallint,
  -- outfield attributes, 1-100
  pace          smallint not null default 50,
  shooting      smallint not null default 50,
  passing       smallint not null default 50,
  vision        smallint not null default 50,
  technique     smallint not null default 50,
  strength      smallint not null default 50,
  defending     smallint not null default 50,
  positioning   smallint not null default 50,
  composure     smallint not null default 50,
  stamina       smallint not null default 50,
  flair         smallint not null default 50,
  -- goalkeeping attributes, 1-100
  reflexes      smallint not null default 50,
  handling      smallint not null default 50,
  distribution  smallint not null default 50,
  one_on_ones   smallint not null default 50,
  created_at    timestamptz not null default now()
);

create index if not exists players_club_id_idx on public.players (club_id);

/* --------------------------------------------------------------- managers */

create table if not exists public.managers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  club_id    text references public.clubs (id) on delete set null,
  reputation smallint not null default 50,
  created_at timestamptz not null default now(),
  unique (user_id)
);

/* --------------------------------------------------------------- fixtures */

create table if not exists public.fixtures (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.managers (id) on delete cascade,
  round         smallint not null,
  home_club_id  text not null references public.clubs (id),
  away_club_id  text not null references public.clubs (id),
  match_date    date,
  home_score    smallint,
  away_score    smallint,
  played        boolean not null default false,
  created_at    timestamptz not null default now(),
  check (home_club_id <> away_club_id)
);

create index if not exists fixtures_manager_id_idx on public.fixtures (manager_id, round);

/* ----------------------------------------------------------- match events */
-- One row per decision the manager took: the probability they were shown, the
-- roll they got, and what came of it. This is the audit trail behind the
-- game's promise that nothing is decided off-screen, and it is what future
-- manager records ("lowest probability ever converted") will be built from.

create table if not exists public.match_events (
  id          uuid primary key default gen_random_uuid(),
  fixture_id  uuid not null references public.fixtures (id) on delete cascade,
  minute      smallint not null check (minute between 0 and 120),
  team_id     text references public.clubs (id),
  player_id   uuid references public.players (id) on delete set null,
  situation   text not null,
  action      text not null,
  probability smallint not null check (probability between 1 and 99),
  roll        smallint not null check (roll between 1 and 100),
  outcome     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists match_events_fixture_id_idx on public.match_events (fixture_id);

/* ------------------------------------------------------------------- RLS */

alter table public.managers     enable row level security;
alter table public.fixtures     enable row level security;
alter table public.match_events enable row level security;

-- Clubs and players are shared reference data: readable by anyone signed in.
alter table public.clubs   enable row level security;
alter table public.players enable row level security;

create policy "clubs are readable" on public.clubs
  for select using (true);

create policy "players are readable" on public.players
  for select using (true);

create policy "managers manage their own row" on public.managers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fixtures belong to the manager" on public.fixtures
  for all using (
    exists (
      select 1 from public.managers m
      where m.id = fixtures.manager_id and m.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.managers m
      where m.id = fixtures.manager_id and m.user_id = auth.uid()
    )
  );

create policy "match events belong to the manager" on public.match_events
  for all using (
    exists (
      select 1
      from public.fixtures f
      join public.managers m on m.id = f.manager_id
      where f.id = match_events.fixture_id and m.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.fixtures f
      join public.managers m on m.id = f.manager_id
      where f.id = match_events.fixture_id and m.user_id = auth.uid()
    )
  );
