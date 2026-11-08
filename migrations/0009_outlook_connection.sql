-- Refresh tokens are encrypted with a key derived from the Microsoft client secret.
CREATE TABLE IF NOT EXISTS outlook_connections (
 restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
 account_email TEXT NOT NULL,
 refresh_token TEXT NOT NULL,
 connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
