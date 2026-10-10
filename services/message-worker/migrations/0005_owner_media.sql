-- Cropped owner images reuse the private Worker D1 binding. No original filenames,
-- EXIF data, login information, or visitor identifiers are stored with an image.
CREATE TABLE owner_media (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 2048),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 2048),
  bytes INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 1048576),
  data BLOB NOT NULL CHECK (typeof(data) = 'blob' AND length(data) = bytes),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE owner_media_usage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bytes_used INTEGER NOT NULL DEFAULT 0 CHECK (bytes_used BETWEEN 0 AND 104857600),
  images INTEGER NOT NULL DEFAULT 0 CHECK (images BETWEEN 0 AND 1000),
  day_start INTEGER NOT NULL DEFAULT 0,
  daily_uploads INTEGER NOT NULL DEFAULT 0
) STRICT;
INSERT INTO owner_media_usage (id) VALUES (1);

-- Each INSERT and these triggers run in one SQLite transaction. Concurrent
-- uploads cannot exceed either cap; retries of the same digest cost no quota.
-- Keep canonical trigger keywords, LF endings, and no conditional expression
-- nesting: D1's remote statement splitter is more restrictive than SQLite's.
CREATE TRIGGER owner_media_capacity BEFORE INSERT ON owner_media
WHEN NOT EXISTS (SELECT 1 FROM owner_media WHERE sha256 = NEW.sha256)
BEGIN
  SELECT RAISE(ABORT, 'media_capacity') WHERE (SELECT bytes_used FROM owner_media_usage WHERE id = 1) + NEW.bytes > 104857600
    OR (SELECT images FROM owner_media_usage WHERE id = 1) >= 1000;
  SELECT RAISE(ABORT, 'media_rate_limit') WHERE (SELECT day_start FROM owner_media_usage WHERE id = 1) = CAST(NEW.created_at / 86400 AS INTEGER) * 86400
    AND (SELECT daily_uploads FROM owner_media_usage WHERE id = 1) >= 100;
END;
CREATE TRIGGER owner_media_account AFTER INSERT ON owner_media
BEGIN
  UPDATE owner_media_usage SET bytes_used = bytes_used + NEW.bytes, images = images + 1,
    daily_uploads = daily_uploads * (day_start = CAST(NEW.created_at / 86400 AS INTEGER) * 86400) + 1,
    day_start = CAST(NEW.created_at / 86400 AS INTEGER) * 86400 WHERE id = 1;
END;
CREATE TRIGGER owner_media_immutable BEFORE UPDATE ON owner_media
BEGIN
  SELECT RAISE(ABORT, 'media_immutable');
END;
CREATE TRIGGER owner_media_removed AFTER DELETE ON owner_media
BEGIN
  UPDATE owner_media_usage SET bytes_used = bytes_used - OLD.bytes, images = images - 1 WHERE id = 1;
END;
