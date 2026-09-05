/*
# Property Fy — Real Estate CRM Schema

## Overview
Creates the core database tables for a real estate sales tracking CRM with
role-based access control. Uses a custom auth table (username/password) because
the app uses username+phone login, NOT email-based Supabase Auth.

## Tables
1. **users** — CRM team members (Super Admin, Sales Manager, Sales Agent).
   - id (uuid PK), username (unique), password_hash, role, mobile, full_name,
     created_at, last_login_at.
2. **leads** — Real estate leads/pipeline.
   - id (uuid PK), client_name, phone, requirement, budget_range, lead_source,
     stage, assigned_to (FK users.id), next_followup_at, token_amount,
     notes, call_outcome, created_at, updated_at.
3. **activity_logs** — Audit trail of actions on leads.
   - id (uuid PK), lead_id (FK leads.id), user_id (FK users.id),
     action, detail, created_at.

## Security
Since this app uses a custom auth table (not Supabase Auth), all access runs
as the `anon` role. RLS is enabled but policies allow anon+authenticated CRUD
so the frontend can operate. The application layer enforces role-based logic.
(Upgrade path: move to Supabase Auth + JWT claims for true server-side RBAC.)

## Seed Data
- 1 Super Admin (admin / admin123)
- 1 Sales Manager + 2 Sales Agents
- 6 demo leads across all pipeline stages
*/

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'manager', 'agent')),
  mobile text,
  full_name text,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text NOT NULL,
  requirement text,
  budget_range text,
  lead_source text DEFAULT 'Social Media' CHECK (lead_source IN ('Social Media', 'Direct Marketing/Visit', 'Walk-in', 'Cold Calling')),
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Attempt', 'Follow-up Date', 'Negotiate', 'Token Received', 'Won', 'Lost')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  next_followup_at timestamptz,
  token_amount numeric,
  notes text DEFAULT '',
  call_outcome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- ACTIVITY_LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_lead_id ON activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);

DROP POLICY IF EXISTS "anon_select_activity_logs" ON activity_logs;
CREATE POLICY "anon_select_activity_logs" ON activity_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activity_logs" ON activity_logs;
CREATE POLICY "anon_insert_activity_logs" ON activity_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activity_logs" ON activity_logs;
CREATE POLICY "anon_update_activity_logs" ON activity_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activity_logs" ON activity_logs;
CREATE POLICY "anon_delete_activity_logs" ON activity_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUTO-UPDATE updated_at ON LEADS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA
-- ============================================================
-- NOTE: password_hash stores a simple hash for demo purposes.
-- admin / admin123 -> hash: pf_a8f3b2c1d4e5
-- We use a deterministic client-side hash; the app compares hashes.

INSERT INTO users (username, password_hash, role, mobile, full_name) VALUES
  ('admin', 'pf_0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33', 'super_admin', '+919876543210', 'Super Admin'),
  ('manager1', 'pf_0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33', 'manager', '+919876543211', 'Rajesh Kumar'),
  ('agent1', 'pf_0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33', 'agent', '+919876543212', 'Priya Sharma'),
  ('agent2', 'pf_0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33', 'agent', '+919876543213', 'Arjun Mehta')
ON CONFLICT (username) DO NOTHING;

-- Insert demo leads referencing seeded users
INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Sanjay Gupta', '+919812345670', '2-Bed Apartment', '45-55 Lakhs', 'Social Media', 'New',
  (SELECT id FROM users WHERE username='agent1'),
  now() + interval '2 days', null, 'Interested in ready-to-move 2BHK in Whitefield', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Sanjay Gupta');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Anita Reddy', '+919812345671', '120 Sq Yds Plot', '35-40 Lakhs', 'Walk-in', 'Attempt',
  (SELECT id FROM users WHERE username='agent1'),
  now() + interval '1 day', null, 'Called once, no response. Try again tomorrow.', 'Not Responding'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Anita Reddy');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Mohammed Iqbal', '+919812345672', '3-Bed Apartment', '70-85 Lakhs', 'Direct Marketing/Visit', 'Follow-up Date',
  (SELECT id FROM users WHERE username='agent2'),
  now() + interval '3 hours', null, 'Visited site, very interested. Following up on loan approval.', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Mohammed Iqbal');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Kavitha Nair', '+919812345673', 'Commercial Shop', '1-1.5 Crore', 'Cold Calling', 'Negotiate',
  (SELECT id FROM users WHERE username='agent2'),
  now() + interval '5 days', null, 'Negotiating on price. Wants 5% discount.', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Kavitha Nair');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Vikram Singh', '+919812345674', '2-Bed Apartment', '50-60 Lakhs', 'Social Media', 'Token Received',
  (SELECT id FROM users WHERE username='agent1'),
  now() + interval '7 days', 50000, 'Token of Rs.50,000 received. Sale deed in process.', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Vikram Singh');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Deepa Iyer', '+919812345675', '120 Sq Yds Plot', '30-35 Lakhs', 'Direct Marketing/Visit', 'Won',
  (SELECT id FROM users WHERE username='agent2'),
  null, 100000, 'Deal closed! Full payment received. Commission earned.', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Deepa Iyer');

INSERT INTO leads (client_name, phone, requirement, budget_range, lead_source, stage, assigned_to, next_followup_at, token_amount, notes, call_outcome)
SELECT
  'Rohit Verma', '+919812345676', '3-Bed Apartment', '65-75 Lakhs', 'Social Media', 'Lost',
  (SELECT id FROM users WHERE username='agent1'),
  null, null, 'Went with competitor due to lower price.', null
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE client_name = 'Rohit Verma');

-- Seed activity logs
INSERT INTO activity_logs (lead_id, user_id, action, detail)
SELECT l.id, l.assigned_to, 'Lead Created', 'New lead added via ' || l.lead_source
FROM leads l
WHERE NOT EXISTS (SELECT 1 FROM activity_logs WHERE lead_id = l.id);