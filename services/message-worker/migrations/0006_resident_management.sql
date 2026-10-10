-- An approved animal keeps its place while resting indoors. Status and the
-- original visitor credential/submission remain unchanged when its details edit.
ALTER TABLE farm_adoptions ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));
ALTER TABLE farm_adoptions ADD COLUMN version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0);
ALTER TABLE farm_adoptions ADD COLUMN since TEXT CHECK (
  since IS NULL OR (
    length(since) = 7 AND since GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    AND substr(since, 6, 2) BETWEEN '01' AND '12'
  )
);
-- Preserve the public month of every existing record; new submissions can use
-- NULL so the original created_at month remains the default until edited.
UPDATE farm_adoptions SET since = substr(created_at, 1, 7);
