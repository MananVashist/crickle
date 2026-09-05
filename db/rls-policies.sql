-- Row Level Security for the crickle_* tables.
--
-- DO NOT RUN THIS UNTIL THE APP CHANGE IN THIS BRANCH IS DEPLOYED, and until
-- Supabase is configured to accept this Firebase project's tokens. Run it
-- before either and the live app breaks. The order is in README terms:
--
--   1. Supabase Dashboard -> Authentication -> Sign In / Providers ->
--      Third Party Auth -> add Firebase, project id `crickle-1b6a7`.
--      Until this exists, auth.jwt() is empty for every request and every
--      policy below matches nothing.
--   2. Deploy this branch. The client starts sending its Firebase ID token,
--      both to our own API routes and to Supabase itself.
--   3. Then run this file.
--
-- ---------------------------------------------------------------------------
-- WHY THIS WAS NOT POSSIBLE BEFORE
--
-- Measured on 2026-09-05: all three tables had RLS off, and the anon key --
-- which is public by design and sits in a PUBLIC repo -- read every row of
-- them through PostgREST. crickle_user_tokens pairs Firebase uids with FCM
-- push tokens, which is enough to send notifications to a real player's
-- device.
--
-- It could not simply be switched on. Crickle authenticates with Firebase, so
-- Supabase saw every request as `anon` with no identity attached: 0 of 10 token
-- uids and 0 of 20 friendship uids existed in auth.users, and every uid was
-- text of exactly 28 characters -- the Firebase format, not a Supabase one. A
-- `uid = auth.uid()` policy would have matched nothing and denied everything.
--
-- Two client-side mitigations were tried against the live database and both
-- broke token refresh (401 on upsert, 201 on first insert), because PostgREST's
-- upsert is INSERT ... ON CONFLICT DO UPDATE and must READ the row it writes. A
-- client that can write its own token can always read it. That is why the fix
-- had to be an identity rather than a cleverer policy.
--
-- With third-party auth configured, auth.jwt()->>'sub' IS the Firebase uid, and
-- the policies below are the obvious ones.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- WHY EVERY POLICY BELOW NAMES BOTH `authenticated` AND `anon`
--
-- Supabase's own guidance for Firebase third-party auth is to set a custom
-- claim `role: "authenticated"` on every Firebase user, because PostgREST picks
-- the database role from that claim and falls back to `anon` when it is absent.
-- Doing that means running admin code over every existing user AND arranging it
-- for every future one, and a user whose claim was missed would be silently
-- denied everything.
--
-- These policies do not depend on it. They are granted to both roles and gated
-- on the SUBJECT rather than the role, so they behave identically whether the
-- token maps to `authenticated` or to `anon`.
--
-- Naming `anon` does NOT weaken them. The test is `uid = public.firebase_uid()`,
-- and for a caller with no token firebase_uid() is NULL, so the comparison is
-- NULL, which is not true, and the row is denied. An unauthenticated request
-- therefore still sees nothing — which is the whole point, and is the thing to
-- re-verify after applying this (see the curl below).
--
-- Setting the claim anyway is fine and slightly tidier; it is just not load
-- bearing, and this file deliberately does not require it.
-- ---------------------------------------------------------------------------

-- Helper: the caller's Firebase uid, or NULL when unauthenticated.
-- Written as a function so the policies read plainly and there is one place to
-- change if the claim ever moves.
create or replace function public.firebase_uid()
returns text
language sql
stable
as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

-- ── crickle_user_tokens ────────────────────────────────────────────────────
-- Your own push token, and nobody else's. The SELECT half is not a courtesy:
-- it is what lets the client's upsert read its own row on conflict.
alter table public.crickle_user_tokens enable row level security;

drop policy if exists crickle_user_tokens_owner on public.crickle_user_tokens;
create policy crickle_user_tokens_owner on public.crickle_user_tokens
  for all
  to authenticated, anon
  using (uid = public.firebase_uid())
  with check (uid = public.firebase_uid());

-- ── crickle_friendships ────────────────────────────────────────────────────
-- Either side of the friendship can see it.
--
-- READ ONLY from the browser. Every write goes through api/h2h/friends.js,
-- which runs as service_role and bypasses these policies -- and which now
-- derives the acting uid from a verified token rather than from the request
-- body. Creating and accepting friend requests needs to touch rows that are
-- not yet yours (a pending row is `user_b_uid = 'pending'`), which is exactly
-- the kind of thing a server should do and a browser should not.
alter table public.crickle_friendships enable row level security;

drop policy if exists crickle_friendships_participant_read on public.crickle_friendships;
create policy crickle_friendships_participant_read on public.crickle_friendships
  for select
  to authenticated, anon
  using (public.firebase_uid() in (user_a_uid, user_b_uid));

-- ── crickle_challenges ─────────────────────────────────────────────────────
-- Both players in a challenge can see it; same read-only reasoning as above,
-- with scoring handled by api/h2h/challenge-submit.js.
alter table public.crickle_challenges enable row level security;

drop policy if exists crickle_challenges_participant_read on public.crickle_challenges;
create policy crickle_challenges_participant_read on public.crickle_challenges
  for select
  to authenticated, anon
  using (public.firebase_uid() in (sender_uid, receiver_uid));

-- ---------------------------------------------------------------------------
-- VERIFY, do not assume. After running this, with the app deployed:
--
--   * A raw anon-key read must return NOTHING from all three tables:
--       curl "$URL/rest/v1/crickle_user_tokens?select=*&limit=1" \
--         -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--     An empty array is the pass. Rows mean third-party auth is not actually
--     in force and this file has not done what it claims.
--   * A signed-in player must still see their own friends, challenges, and be
--     able to register a push token.
--   * Realtime must still deliver: open the app on two devices and send a
--     challenge. Realtime honours RLS, so this is the assertion that proves
--     the policies are permissive enough as well as restrictive enough.
--
-- TO REVERT, if something is wrong:
--   alter table public.crickle_user_tokens  disable row level security;
--   alter table public.crickle_friendships  disable row level security;
--   alter table public.crickle_challenges   disable row level security;
-- ---------------------------------------------------------------------------
