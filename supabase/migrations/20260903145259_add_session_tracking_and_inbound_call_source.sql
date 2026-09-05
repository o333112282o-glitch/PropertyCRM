/*
# Add Session Tracking, Inbound Call Source, and Last Active Timestamp

## Purpose
Support the new Team Session & Attendance Tracker feature and the Inbound Call workflow.

## Changes

### 1. New Table: `session_logs`
Tracks each user's login and logout events with timestamps, enabling
calculation of total daily active hours per agent.

Columns:
- `id` (uuid, PK)
- `user_id` (uuid, FK to users.id, NOT NULL) — which user the session belongs to
- `login_at` (timestamptz, NOT NULL, default now()) — when the session started
- `logout_at` (timestamptz, nullable) — when the session ended (null = still active)
- `created_at` (timestamptz, default now())

### 2. Modified Table: `users`
- Added `last_active_at` (timestamptz, nullable) — updated by a frontend heartbeat
  every ~30 seconds; used to determine Online/Idle/Offline status.

### 3. Modified Table: `leads`
- Updated `lead_source` CHECK constraint to include 'Dealer Sourced' and 'Inbound Call'
  (the Dealer Sourced value was already being inserted by the frontend but wasn't in the constraint).

### 4. Security
- RLS enabled on `session_logs` with full CRUD for `anon, authenticated` since this app
  uses a custom auth flow (not Supabase Auth) and all authenticated app users need access.
- Index on `session_logs.user_id` for efficient per-user queries.
- Index on `session_logs.login_at` for efficient daily aggregation.
*/

-- ── 1. Add last_active_at to users ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_active_at timestamptz;
  END IF;
END $$;

-- ── 2. Update lead_source CHECK to include Dealer Sourced + Inbound Call ──
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source = ANY (ARRAY[
    'Social Media'::text,
    'Direct Marketing/Visit'::text,
    'Walk-in'::text,
    'Cold Calling'::text,
    'Dealer Sourced'::text,
    'Inbound Call'::text
  ]));

-- ── 3. Create session_logs table ────────────────────────────
CREATE TABLE IF NOT EXISTS session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_select_all" ON session_logs;
CREATE POLICY "session_select_all"
  ON session_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "session_insert_all" ON session_logs;
CREATE POLICY "session_insert_all"
  ON session_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "session_update_all" ON session_logs;
CREATE POLICY "session_update_all"
  ON session_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "session_delete_all" ON session_logs;
CREATE POLICY "session_delete_all"
  ON session_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ── 4. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_login_at ON session_logs(login_at);

-- ── 5. Enable realtime for session_logs ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_logs;
  END IF;
END $$;
