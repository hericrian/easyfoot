-- Base inicial do EasyFoot
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  is_goalkeeper boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Pelada',
  location text,
  starts_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team text,
  goals integer not null default 0,
  won boolean not null default false,
  primary key (match_id, player_id)
);
