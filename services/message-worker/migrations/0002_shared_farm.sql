-- The orchard and approved visitors' animals are shared by every browser.
-- Visitor credentials are hashed; public API responses never expose them.
CREATE TABLE farm_trees (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('apple', 'peach', 'orange', 'cherry', 'kiwi', 'grape', 'durian', 'mango')),
  slot INTEGER NOT NULL UNIQUE CHECK (slot BETWEEN 0 AND 7),
  seed INTEGER NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
  variant INTEGER NOT NULL CHECK (variant BETWEEN 0 AND 2),
  planted_abs INTEGER NOT NULL CHECK (planted_abs >= 0),
  water INTEGER NOT NULL DEFAULT 0 CHECK (water BETWEEN 0 AND 3),
  owner_hash TEXT CHECK (owner_hash IS NULL OR length(owner_hash) = 64),
  initial INTEGER NOT NULL DEFAULT 0 CHECK (initial IN (0, 1)),
  created_at TEXT NOT NULL
);
INSERT INTO farm_trees (id, type, slot, seed, variant, planted_abs, water, owner_hash, initial, created_at) VALUES
  ('initial-cherry', 'cherry', 1, 11, 2, 0, 3, NULL, 1, '2026-10-10T00:00:00.000Z'),
  ('initial-apple', 'apple', 2, 23, 2, 0, 3, NULL, 1, '2026-10-10T00:00:00.000Z'),
  ('initial-peach', 'peach', 0, 37, 1, 0, 3, NULL, 1, '2026-10-10T00:00:00.000Z'),
  ('initial-orange', 'orange', 3, 41, 2, 0, 3, NULL, 1, '2026-10-10T00:00:00.000Z');

-- Completed writes retain their result so network retries cannot plant or
-- water twice, even after another visitor changes or removes that tree.
CREATE TABLE farm_operations (
  submission_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('plant', 'water')),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
  tree_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE farm_adoptions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64),
  species TEXT NOT NULL CHECK (species IN ('rabbit', 'panda', 'fox', 'shiba', 'hedgehog', 'duckling', 'penguin')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 24),
  adopted_by TEXT NOT NULL CHECK (length(adopted_by) BETWEEN 1 AND 40),
  note TEXT NOT NULL CHECK (length(note) <= 140),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX farm_adoptions_status_idx ON farm_adoptions (status, created_at, id);
CREATE INDEX farm_adoptions_visitor_idx ON farm_adoptions (visitor_hash, status);
