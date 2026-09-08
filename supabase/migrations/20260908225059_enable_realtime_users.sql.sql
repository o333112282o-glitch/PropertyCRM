-- Enable Supabase Realtime on users table
-- so presence status (last_active_at changes) updates live across all views.

ALTER PUBLICATION supabase_realtime ADD TABLE users;