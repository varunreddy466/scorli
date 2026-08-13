-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- trigger to auto-insert profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles on delete set null,
  game_type_slug text not null,
  config jsonb,
  status text not null default 'in_progress',
  target_score int,
  created_at timestamptz default now() not null,
  ended_at timestamptz
);

-- game_players
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  guest_name text,
  seat_order int not null,
  color text not null,
  constraint gp_identity_check check (profile_id is not null or guest_name is not null)
);

-- rounds
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games on delete cascade,
  round_number int not null,
  created_at timestamptz default now() not null
);

-- scores
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds on delete cascade,
  game_player_id uuid not null references public.game_players on delete cascade,
  points numeric not null,
  modifiers jsonb,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

-- friendships
create table public.friendships (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending',
  created_at timestamptz default now() not null,
  primary key (user_id, friend_id)
);

-- Indexes
create index on public.games (owner_id, status);
create index on public.game_players (game_id);
create index on public.game_players (profile_id);
create index on public.rounds (game_id);
create index on public.scores (round_id);
create index on public.scores (game_player_id);
create index on public.friendships (friend_id);

-- helper function to check game access (avoids RLS recursion); define after
-- referenced tables because language sql bodies are resolved at creation time
create or replace function public.can_access_game(p_game_id uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game_id and g.owner_id = auth.uid()
  ) or exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.profile_id = auth.uid()
  );
$$;

revoke execute on function public.can_access_game(uuid) from public, anon;
grant execute on function public.can_access_game(uuid) to authenticated;
