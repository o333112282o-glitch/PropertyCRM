/*
# Add Dealer Role and Dealer-Sourced Lead Tracking

1. Changes
- Extends `users.role` CHECK constraint to include 'dealer' as a 4th role.
  Dealers submit leads and can only view their own submissions.
- Adds `source_dealer_id` column to `leads` — nullable FK to `users(id)`.
  When a dealer submits a lead, this column stores their user ID so the
  app can filter "my submissions" for dealers and tag "Dealer Sourced"
  in admin/manager views.
- Adds an index on `source_dealer_id` for dealer dashboard queries.
2. Security
- No RLS policy changes. The app uses a custom auth table with anon-key
  CRUD; role enforcement is handled in the application layer (same pattern
  as the existing super_admin / manager / agent roles).
3. Idempotency
- Uses DO $$ blocks to conditionally add the column and drop/recreate the
  constraint, so re-running is safe.
*/

-- Add 'dealer' to the users role CHECK constraint
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'manager', 'agent', 'dealer'));
END $$;

-- Add source_dealer_id column to leads (nullable, FK to users)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'source_dealer_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN source_dealer_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_source_dealer_id ON leads(source_dealer_id);