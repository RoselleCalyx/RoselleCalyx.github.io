-- SQLite CHECK constraints require rebuilding the table to admit new animals.
-- Keep every submission, review status and credential digest from the shared farm.
CREATE TABLE farm_adoptions_expanded (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
  species TEXT NOT NULL CHECK (species IN ('rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin', 'redpanda', 'raccoon', 'wolf', 'crocodile', 'fennec')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 24),
  adopted_by TEXT NOT NULL CHECK (length(adopted_by) BETWEEN 1 AND 40),
  note TEXT NOT NULL CHECK (length(note) <= 140),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
INSERT INTO farm_adoptions_expanded (id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at, reviewed_at)
  SELECT id, submission_id, payload_hash, visitor_hash, species, name, adopted_by, note, status, created_at, reviewed_at FROM farm_adoptions;
DROP TABLE farm_adoptions;
ALTER TABLE farm_adoptions_expanded RENAME TO farm_adoptions;
CREATE INDEX farm_adoptions_status_idx ON farm_adoptions (status, created_at, id);
CREATE INDEX farm_adoptions_visitor_idx ON farm_adoptions (visitor_hash, status);
