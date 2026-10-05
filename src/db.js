import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  visible_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  email_notifications INTEGER NOT NULL DEFAULT 1,
  default_reminder_minutes INTEGER DEFAULT 1440,
  daily_digest INTEGER NOT NULL DEFAULT 0,
  digest_hour INTEGER NOT NULL DEFAULT 7,
  last_digest_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS time_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  is_break INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_slots_user ON time_slots(user_id);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#4f46e5',
  room TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  room_override TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, slot_id, day)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task','exam')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  due_at TEXT NOT NULL,
  reminder_minutes INTEGER,
  reminder_sent_at TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_items_user_due ON items(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_items_reminders ON items(done, reminder_sent_at, due_at);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checklist_item ON checklist_items(item_id);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

/** Runs fn inside a transaction, rolling back if it throws. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const DEFAULT_SLOTS = [
  ['08:00', '08:55', '1ª hora', 0],
  ['08:55', '09:50', '2ª hora', 0],
  ['09:50', '10:45', '3ª hora', 0],
  ['10:45', '11:15', 'Recreo', 1],
  ['11:15', '12:10', '4ª hora', 0],
  ['12:10', '13:05', '5ª hora', 0],
  ['13:05', '14:00', '6ª hora', 0],
];
