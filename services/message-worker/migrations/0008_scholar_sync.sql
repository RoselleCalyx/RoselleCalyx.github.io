-- Keep synchronization provenance outside the editable public content.
CREATE TABLE scholar_sync (
 id INTEGER PRIMARY KEY CHECK(id=1),
 baseline_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(baseline_json)),
 next_check INTEGER NOT NULL DEFAULT 0,
 last_success TEXT,
 last_error TEXT NOT NULL DEFAULT ''
);
INSERT INTO scholar_sync(id) VALUES(1);
