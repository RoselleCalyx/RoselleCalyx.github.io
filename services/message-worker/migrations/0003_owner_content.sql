-- Owner content contains public presentation data only. Credentials remain secrets.
CREATE TABLE site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT,
  content_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(content_json))
);
INSERT INTO site_content (id) VALUES (1);

ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done', 'archived'));
ALTER TABLE messages ADD COLUMN host_note TEXT NOT NULL DEFAULT '' CHECK (length(host_note) <= 2000);
