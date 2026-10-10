-- Persistent, collision-free public identities. Credentials/names never become aliases.
CREATE TABLE visitor_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_key TEXT NOT NULL UNIQUE
);
INSERT INTO visitor_aliases (id, identity_key) VALUES (1, 'ea0ebd131bbd9a83496b50f9f8759cab3d3e2acc17aa1acc5cbe507af808fffe');
