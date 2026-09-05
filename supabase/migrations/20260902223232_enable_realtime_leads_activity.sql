/*
# Enable Supabase Realtime on leads and activity_logs

1. Changes
- Adds `leads` and `activity_logs` tables to the supabase_realtime publication.
- This enables the Postgres Changes plugin so the frontend can subscribe to
  INSERT / UPDATE / DELETE events on these tables via supabase.channel().
2. Security
- No RLS changes. Realtime respects RLS policies — anon/authenticated roles
  only receive events for rows they can read.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;