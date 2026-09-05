/*
# Add manager_id to users table — Manager-Agent Hierarchy

## Overview
Adds a `manager_id` self-referencing foreign key to the `users` table so that
Sales Agents can be linked to a specific Sales Manager. This enables
manager-scoped visibility: a manager sees only leads, stats, and activity
for agents assigned to them.

## Changes
1. New column: `users.manager_id` (uuid, nullable, FK to `users(id)` ON DELETE SET NULL).
   - When a Sales Agent is assigned a Manager, this column stores that Manager's user ID.
   - NULL means the agent has no manager assigned (or the user is not an agent).
2. Index on `manager_id` for efficient manager-scoped queries.
3. No RLS policy changes — the app uses a custom auth table with anon-key CRUD
   and enforces role-based visibility in the application layer (same pattern as
   existing roles).

## Idempotency
- Uses a DO $$ block to conditionally add the column so re-running is safe.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE users ADD COLUMN manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);