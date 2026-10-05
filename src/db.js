import fs from 'node:fs';
import path from 'node:path';

/*
 * Capa de base de datos con dos motores:
 *  - SQLite (archivo local): para desarrollo, pruebas o un servidor con disco propio.
 *  - MySQL / MariaDB: para producción, por ejemplo la base de datos de Hostinger.
 * Las dos ofrecen la misma interfaz asíncrona: get, all, run y tx.
 */

const SQLITE_SCHEMA = `
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
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint_hash TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS app_settings (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// Compatible con MySQL 5.7+, MySQL 8 y MariaDB 10.3+ (lo que ofrece Hostinger).
const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid',
    visible_days VARCHAR(40) NOT NULL DEFAULT '[1,2,3,4,5]',
    email_notifications TINYINT NOT NULL DEFAULT 1,
    default_reminder_minutes INT NULL DEFAULT 1440,
    daily_digest TINYINT NOT NULL DEFAULT 0,
    digest_hour TINYINT NOT NULL DEFAULT 7,
    last_digest_date VARCHAR(10) NULL,
    created_at VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_users_email (email)
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at BIGINT NOT NULL,
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_expires (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS time_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_time CHAR(5) NOT NULL,
    end_time CHAR(5) NOT NULL,
    label VARCHAR(40) NOT NULL DEFAULT '',
    is_break TINYINT NOT NULL DEFAULT 0,
    KEY idx_slots_user (user_id),
    CONSTRAINT fk_slots_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(60) NOT NULL,
    short_name VARCHAR(6) NOT NULL DEFAULT '',
    color CHAR(7) NOT NULL DEFAULT '#4f46e5',
    room VARCHAR(60) NOT NULL DEFAULT '',
    teacher VARCHAR(80) NOT NULL DEFAULT '',
    KEY idx_subjects_user (user_id),
    CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS schedule_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    slot_id INT NOT NULL,
    day TINYINT NOT NULL,
    room_override VARCHAR(60) NOT NULL DEFAULT '',
    UNIQUE KEY uq_schedule (user_id, slot_id, day),
    CONSTRAINT fk_sched_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_slot FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(4) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    subject_id INT NULL,
    due_at VARCHAR(30) NOT NULL,
    reminder_minutes INT NULL,
    reminder_sent_at VARCHAR(30) NULL,
    done TINYINT NOT NULL DEFAULT 0,
    done_at VARCHAR(30) NULL,
    created_at VARCHAR(30) NOT NULL,
    KEY idx_items_user_due (user_id, due_at),
    KEY idx_items_reminders (done, reminder_sent_at, due_at),
    CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    text VARCHAR(200) NOT NULL,
    done TINYINT NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    KEY idx_checklist_item (item_id),
    CONSTRAINT fk_checklist_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint_hash CHAR(64) NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    created_at VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_push_endpoint (endpoint_hash),
    KEY idx_push_user (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${TABLE_OPTS}`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    name VARCHAR(64) NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
  ) ${TABLE_OPTS}`,
];

/*
 * Columnas añadidas después de la primera versión. Se crean al arrancar si faltan,
 * así las bases de datos que ya existen (por ejemplo, la de Hostinger) se actualizan solas.
 */
const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN tt_background VARCHAR(20) NOT NULL DEFAULT 'rayas'",
];
async function migrate(api) {
  for (const sql of MIGRATIONS) {
    try {
      await api.run(sql);
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) throw err;
    }
  }
}

/** Lee la configuración de la base de datos de las variables de entorno. */
export function dbConfigFromEnv(env = process.env) {
  const url = env.DATABASE_URL || env.MYSQL_URL;
  const ssl = env.MYSQL_SSL === 'true';
  if (url && /^mysql2?:\/\//.test(url)) return { mysql: { uri: url.replace(/^mysql2:/, 'mysql:'), ssl } };
  if (env.MYSQL_HOST) {
    return {
      mysql: {
        host: env.MYSQL_HOST,
        port: Number(env.MYSQL_PORT || 3306),
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        ssl,
      },
    };
  }
  return { file: env.DB_FILE || 'data/horario.db' };
}

export async function openDb(config = { file: ':memory:' }) {
  return config.mysql ? openMysql(config.mysql) : openSqlite(config.file ?? ':memory:');
}

async function openSqlite(file) {
  const { DatabaseSync } = await import('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SQLITE_SCHEMA);

  // node:sqlite es síncrono: estas funciones se resuelven sin ceder el turno a
  // otras peticiones, así que una transacción no se mezcla con otras consultas.
  const api = {
    dialect: 'sqlite',
    async get(sql, ...params) {
      return db.prepare(sql).get(...params);
    },
    async all(sql, ...params) {
      return db.prepare(sql).all(...params);
    },
    async run(sql, ...params) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), insertId: Number(r.lastInsertRowid) };
    },
    async tx(fn) {
      db.exec('BEGIN');
      try {
        const result = await fn(api);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async close() {
      db.close();
    },
  };
  await migrate(api);
  return api;
}

async function openMysql(cfg) {
  const { default: mysql } = await import('mysql2/promise');
  const pool = mysql.createPool({
    ...(cfg.uri ? { uri: cfg.uri } : { host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database }),
    ssl: cfg.ssl ? {} : undefined,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
    enableKeepAlive: true,
    connectTimeout: 15000,
  });
  const wrap = (conn) => ({
    dialect: 'mysql',
    async get(sql, ...params) {
      const [rows] = await conn.query(sql, params);
      return rows[0];
    },
    async all(sql, ...params) {
      const [rows] = await conn.query(sql, params);
      return rows;
    },
    async run(sql, ...params) {
      const [r] = await conn.query(sql, params);
      return { changes: r.affectedRows, insertId: r.insertId };
    },
  });
  const api = wrap(pool);
  api.tx = async (fn) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(wrap(conn));
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  };
  api.close = () => pool.end();
  for (const stmt of MYSQL_SCHEMA) await pool.query(stmt);
  await migrate(api);
  return api;
}

export const TT_BACKGROUNDS = ['rayas', 'rayas-rosa', 'cuadricula', 'puntos', 'lisa', 'arena', 'menta', 'lavanda', 'cielo', 'noche'];

export const DEFAULT_SLOTS = [
  ['08:00', '08:55', '1ª hora', 0],
  ['08:55', '09:50', '2ª hora', 0],
  ['09:50', '10:45', '3ª hora', 0],
  ['10:45', '11:15', 'Recreo', 1],
  ['11:15', '12:10', '4ª hora', 0],
  ['12:10', '13:05', '5ª hora', 0],
  ['13:05', '14:00', '6ª hora', 0],
];
