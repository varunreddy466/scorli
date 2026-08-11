-- Enable RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.rounds enable row level security;
alter table public.scores enable row level security;
alter table public.friendships enable row level security;

-- profiles policies
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- games policies
create policy "games_select" on public.games
  for select using (public.can_access_game(id));

create policy "games_insert" on public.games
  for insert with check (owner_id = auth.uid());

create policy "games_update" on public.games
  for update using (owner_id = auth.uid());

create policy "games_delete" on public.games
  for delete using (owner_id = auth.uid());

-- game_players policies
create policy "game_players_select" on public.game_players
  for select using (public.can_access_game(game_id));

create policy "game_players_insert" on public.game_players
  for insert with check (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

create policy "game_players_update" on public.game_players
  for update using (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

create policy "game_players_delete" on public.game_players
  for delete using (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

-- rounds policies
create policy "rounds_select" on public.rounds
  for select using (public.can_access_game(game_id));

create policy "rounds_insert" on public.rounds
  for insert with check (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

create policy "rounds_update" on public.rounds
  for update using (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

create policy "rounds_delete" on public.rounds
  for delete using (
    exists (select 1 from public.games g where g.id = game_id and g.owner_id = auth.uid())
  );

-- scores policies
create policy "scores_select" on public.scores
  for select using (
    exists (
      select 1 from public.rounds r
      where r.id = round_id and public.can_access_game(r.game_id)
    )
  );

create policy "scores_insert" on public.scores
  for insert with check (
    exists (
      select 1 from public.rounds r
      join public.games g on g.id = r.game_id
      where r.id = round_id and g.owner_id = auth.uid()
    )
  );

create policy "scores_update" on public.scores
  for update using (
    exists (
      select 1 from public.rounds r
      join public.games g on g.id = r.game_id
      where r.id = round_id and g.owner_id = auth.uid()
    )
  );

create policy "scores_delete" on public.scores
  for delete using (
    exists (
      select 1 from public.rounds r
      join public.games g on g.id = r.game_id
      where r.id = round_id and g.owner_id = auth.uid()
    )
  );

-- friendships policies
create policy "friendships_select" on public.friendships
  for select using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friendships_insert" on public.friendships
  for insert with check (user_id = auth.uid());

create policy "friendships_update" on public.friendships
  for update using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friendships_delete" on public.friendships
  for delete using (user_id = auth.uid() or friend_id = auth.uid());
