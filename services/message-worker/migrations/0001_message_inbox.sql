-- D1 is accessed only by the Worker binding, never directly by browsers.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  name TEXT CHECK (name IS NULL OR length(name) <= 60),
  contact TEXT CHECK (contact IS NULL OR length(contact) <= 120),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 2 AND 500),
  read_at TEXT
);
CREATE INDEX messages_created_idx ON messages (created_at DESC, id DESC);
CREATE INDEX messages_unread_idx ON messages (created_at DESC) WHERE read_at IS NULL;

CREATE TABLE host_sessions (
  id TEXT PRIMARY KEY,
  access_hash TEXT NOT NULL UNIQUE,
  refresh_hash TEXT NOT NULL UNIQUE,
  access_expires INTEGER NOT NULL,
  refresh_expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX host_sessions_expiry_idx ON host_sessions (refresh_expires);

-- Only keyed, salted IP hashes are stored; no raw visitor IP addresses.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry_idx ON rate_limits (expires_at);

-- This record is inserted in the same transaction as its letter.
CREATE TABLE notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  last_error TEXT
);
CREATE INDEX outbox_pending_idx ON notification_outbox (next_attempt_at, lease_until) WHERE sent_at IS NULL;
