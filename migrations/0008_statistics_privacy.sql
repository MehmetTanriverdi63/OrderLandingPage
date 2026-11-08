-- Aggregate page views only. No visitor ID, IP, user agent or full URL is stored.
CREATE TABLE IF NOT EXISTS page_view_days (
 restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
 day TEXT NOT NULL,
 page TEXT NOT NULL CHECK(page IN ('/','/angebot')),
 views INTEGER NOT NULL DEFAULT 0 CHECK(views >= 0),
 PRIMARY KEY(restaurant_id,day,page)
);
CREATE TABLE IF NOT EXISTS restaurant_privacy (
 restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
 retention_days INTEGER NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 3650),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
