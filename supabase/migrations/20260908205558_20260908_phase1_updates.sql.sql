/*
# Phase 1 Backend Updates — Safe Additive Migration

## Summary
Adds a new lost_reason_type enum, columns to existing tables (users + leads),
three new tables (duplicate_approval_requests, office_meetings, site_visits),
and RLS policies on all new tables.

## Important Notes

### app_role Enum
The `users.role` column is `text` (not an enum type), so 'lead_creator'
is already usable as a plain text value — no ALTER TYPE needed.

### Existing Columns
- `users.manager_id` already exists (migration 20260904120947). Skipped via IF NOT EXISTS.
- `leads.token_amount` already exists but without a default. This migration sets the default to 0.

### RLS Policy Style
This app uses the anon key — all policies use `TO anon, authenticated`
with `USING (true)`, matching every existing table in the schema.

## 1. New Types
- `lost_reason_type` — enum for structured lead loss reasons.

## 2. New Columns on `users`
- `is_disabled` (boolean, default false) — soft-disable flag.

## 3. New Columns on `leads`
- `normalized_mobile` (text) — E.164-normalized phone for dedup.
- `lost_reason` (text) — reason the lead was lost.
- `token_amount` — sets default 0 on existing column.
- `booking_amount` (numeric, default 0) — booking amount.
- `booking_date` (date) — date of booking.
- `payment_mode` (text) — payment method.
- `created_by` (uuid, FK to users) — lead creator.

## 4. Index
- `idx_leads_normalized_mobile` on `leads(normalized_mobile)`.

## 5. New Tables
- `duplicate_approval_requests` — pending approval for duplicate leads.
- `office_meetings` — scheduled office meetings tied to a lead.
- `site_visits` — scheduled site visits tied to a lead.

## 6. Security
- RLS enabled on all three new tables.
- 4 CRUD policies each, scoped to `anon, authenticated`.
*/

-- 1. Lost Reason Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_reason_type') THEN
    CREATE TYPE lost_reason_type AS ENUM (
      'Not Interested',
      'Budget Issue',
      'Price Too High',
      'Location Issue',
      'Payment Plan Issue',
      'Bought Elsewhere',
      'Decision Delayed',
      'Not Responding',
      'Competitor',
      'Other'
    );
  END IF;
END $$;

-- 2. Users: add is_disabled (manager_id already exists)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Leads: add new columns
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS normalized_mobile TEXT,
ADD COLUMN IF NOT EXISTS lost_reason TEXT,
ADD COLUMN IF NOT EXISTS booking_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_date DATE,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- token_amount already exists but without a default — set it to 0
ALTER TABLE leads ALTER COLUMN token_amount SET DEFAULT 0;
UPDATE leads SET token_amount = 0 WHERE token_amount IS NULL;

-- 4. Index on normalized_mobile
CREATE INDEX IF NOT EXISTS idx_leads_normalized_mobile ON leads(normalized_mobile);

-- 5. duplicate_approval_requests
CREATE TABLE IF NOT EXISTS duplicate_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE duplicate_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dup_requests" ON duplicate_approval_requests;
CREATE POLICY "anon_select_dup_requests"
  ON duplicate_approval_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dup_requests" ON duplicate_approval_requests;
CREATE POLICY "anon_insert_dup_requests"
  ON duplicate_approval_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dup_requests" ON duplicate_approval_requests;
CREATE POLICY "anon_update_dup_requests"
  ON duplicate_approval_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dup_requests" ON duplicate_approval_requests;
CREATE POLICY "anon_delete_dup_requests"
  ON duplicate_approval_requests FOR DELETE
  TO anon, authenticated USING (true);

-- 6. office_meetings
CREATE TABLE IF NOT EXISTS office_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  meeting_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  remarks TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_office_meetings" ON office_meetings;
CREATE POLICY "anon_select_office_meetings"
  ON office_meetings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_office_meetings" ON office_meetings;
CREATE POLICY "anon_insert_office_meetings"
  ON office_meetings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_office_meetings" ON office_meetings;
CREATE POLICY "anon_update_office_meetings"
  ON office_meetings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_office_meetings" ON office_meetings;
CREATE POLICY "anon_delete_office_meetings"
  ON office_meetings FOR DELETE
  TO anon, authenticated USING (true);

-- 7. site_visits
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  remarks TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_site_visits" ON site_visits;
CREATE POLICY "anon_select_site_visits"
  ON site_visits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_site_visits" ON site_visits;
CREATE POLICY "anon_insert_site_visits"
  ON site_visits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_site_visits" ON site_visits;
CREATE POLICY "anon_update_site_visits"
  ON site_visits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_site_visits" ON site_visits;
CREATE POLICY "anon_delete_site_visits"
  ON site_visits FOR DELETE
  TO anon, authenticated USING (true);
