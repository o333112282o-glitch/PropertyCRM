-- Phase 1: Safe Additive Migration Script for Property Fy Lead Manager

-- 1. Extend App Roles Enum (Adding lead_creator)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM (
      'master_admin',
      'sales_manager',
      'sales_agent',
      'dealer_manager',
      'dealer',
      'lead_creator'
    );
  ELSE
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'lead_creator';
  END IF;
END $$;

-- 2. Extend Lost Reason Enum
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

-- 3. Add Missing Columns to Users Table Safely
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id);

-- 4. Add Missing Columns to Leads Table Safely
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS normalized_mobile TEXT,
ADD COLUMN IF NOT EXISTS lost_reason TEXT,
ADD COLUMN IF NOT EXISTS token_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_date DATE,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Index for normalized mobile duplicate checking
CREATE INDEX IF NOT EXISTS idx_leads_normalized_mobile ON leads(normalized_mobile);

-- 5. Create Duplicate Approval Requests Table
CREATE TABLE IF NOT EXISTS duplicate_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  requested_by UUID REFERENCES users(id) NOT NULL,
  assigned_agent_id UUID REFERENCES users(id),
  source TEXT NOT NULL,
  status TEXT DEFAULT 'pending_approval',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Dedicated Office Meetings Table
CREATE TABLE IF NOT EXISTS office_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  meeting_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  remarks TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Dedicated Site Visits Table
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  remarks TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE duplicate_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- 9. Basic RLS Policy Setup
CREATE POLICY "Allow authenticated read on duplicate_requests" 
ON duplicate_approval_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on duplicate_requests" 
ON duplicate_approval_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on duplicate_requests" 
ON duplicate_approval_requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on office_meetings" 
ON office_meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert/update on office_meetings" 
ON office_meetings FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on site_visits" 
ON site_visits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert/update on site_visits" 
ON site_visits FOR ALL TO authenticated USING (true);
