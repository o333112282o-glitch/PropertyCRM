ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['super_admin'::text, 'manager'::text, 'agent'::text, 'dealer'::text, 'dealer_manager'::text, 'lead_creator'::text]));