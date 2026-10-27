PRAGMA foreign_keys = ON;
CREATE TABLE restaurants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL,
 hours TEXT NOT NULL, telegram_chat_id TEXT
);
CREATE TABLE products (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), name TEXT NOT NULL,
 description TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), image TEXT NOT NULL,
 badge TEXT, available INTEGER NOT NULL DEFAULT 1, options TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0,
 UNIQUE(restaurant_id,id)
);
CREATE TABLE admins (id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id), expires_at INTEGER NOT NULL);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id), number INTEGER NOT NULL,
 access_token_hash TEXT NOT NULL, request_id TEXT NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '', pickup_at TEXT NOT NULL, confirmed_pickup TEXT,
 status TEXT NOT NULL DEFAULT 'pending', payment_method TEXT NOT NULL, payment_status TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total >= 0), items TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(restaurant_id,request_id), UNIQUE(restaurant_id,number)
);
CREATE INDEX orders_restaurant_created ON orders(restaurant_id,created_at DESC);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE payment_events (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
