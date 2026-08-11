-- RLS isolation tests
-- Run via: supabase db reset && psql ... -f supabase/tests/rls_test.sql

-- Setup: create two users
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  game_a uuid;
begin
  -- Insert auth users (simulated)
  insert into auth.users (id, email) values (user_a, 'usera@test.com'), (user_b, 'userb@test.com');

  -- User A creates a game
  set local role authenticated;
  set local request.jwt.claim.sub = user_a::text;

  insert into public.games (id, owner_id, game_type_slug, status)
  values (gen_random_uuid(), user_a, 'skyjo', 'in_progress')
  returning id into game_a;

  -- Assert user B cannot see user A's game
  set local request.jwt.claim.sub = user_b::text;
  assert not exists (
    select 1 from public.games where id = game_a
  ), 'User B should not see User A game';

  -- Assert user B cannot insert into user A's game
  begin
    insert into public.game_players (game_id, guest_name, seat_order, color)
    values (game_a, 'Intruder', 0, 'red');
    assert false, 'User B should not be able to insert game_players for User A game';
  exception when others then
    -- expected
  end;

  raise notice 'RLS isolation tests passed';
end;
$$;

-- Anon access test: anonymous clients must not be able to read profiles
do $$
begin
  set local role anon;

  assert not exists (
    select 1 from public.profiles limit 1
  ), 'Anonymous clients must not be able to read profiles';

  raise notice 'Anon profiles RLS test passed';
end;
$$;
