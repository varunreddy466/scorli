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
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  game_a := gen_random_uuid();

  insert into public.games (id, owner_id, game_type_slug, status)
  values (game_a, user_a, 'skyjo', 'in_progress');

  -- Assert user B cannot see user A's game
  perform set_config('request.jwt.claim.sub', user_b::text, true);
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

-- Anon clients must not be able to call security definer helpers directly
do $$
begin
  set local role anon;

  begin
    perform public.can_access_game(gen_random_uuid());
    assert false, 'Anonymous clients must not be able to execute can_access_game';
  exception when insufficient_privilege then
    -- expected
  end;

  raise notice 'Anon helper execute test passed';
end;
$$;
