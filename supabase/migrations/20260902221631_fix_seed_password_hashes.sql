/*
# Fix seed password hashes to match client hash function

Updates the password_hash for all seeded users so the client-side hashPassword()
function (SHA-like deterministic hash with 'pf_' prefix) matches the stored value.
All seeded users (admin, manager1, agent1, agent2) use password 'admin123'.
*/
UPDATE users SET password_hash = 'pf_44f23cac'
WHERE username IN ('admin', 'manager1', 'agent1', 'agent2')
  AND password_hash != 'pf_44f23cac';