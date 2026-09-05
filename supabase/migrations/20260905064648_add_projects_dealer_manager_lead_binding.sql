/*
# Projects Table, Dealer Manager Role, Lead Project/Dealer Binding

## Overview
1. Creates a `projects` table for real estate project management.
2. Extends the `users.role` CHECK constraint to include 'dealer_manager'.
3. Adds `project_id` and `dealer_id` columns to `leads` for project selection
   and permanent dealer lead ownership binding.
4. Adds indexes for efficient filtering.

## Tables
- **projects** (new): id, name, description, location, status (active/archived),
  created_at, updated_at. SuperAdmin manages CRUD; all users can read active projects.

## Column Changes
- **leads.project_id** (uuid, nullable, FK to projects.id ON DELETE SET NULL):
  Links a lead to a specific project.
- **leads.dealer_id** (uuid, nullable, FK to users.id ON DELETE SET NULL):
  Permanently binds a dealer to a lead they submitted. Distinct from
  existing `source_dealer_id` (which tracks lead source); `dealer_id` is
  the ownership binding for the dealer portal.

## Role Extension
- `users.role` CHECK now includes 'dealer_manager' (hierarchy:
  SuperAdmin > Dealer Manager > Dealer).

## Security
- RLS enabled on `projects` with anon+authenticated CRUD (same pattern as
  existing tables — application layer enforces role-based access).
- No RLS changes to `leads` or `users`.

## Idempotency
- Uses DO $$ blocks for conditional column additions.
- Uses IF NOT EXISTS for table and index creation.
*/

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- EXTEND USERS ROLE CHECK FOR dealer_manager
-- ============================================================
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'manager', 'agent', 'dealer', 'dealer_manager'));
END $$;

-- ============================================================
-- ADD project_id AND dealer_id TO LEADS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'dealer_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN dealer_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_project_id ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);