CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by TEXT REFERENCES users(id),
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);
