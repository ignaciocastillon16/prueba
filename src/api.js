import express, { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DEFAULT_SLOTS } from './db.js';
import { ITEM_SELECT, attachChecklists, serializeItem } from './items.js';
import { testEmail } from './emails.js';

const SESSION_MS = 30 * 24 * 3600 * 1000;
const COOKIE = 'sid';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (what = 'Elemento') => new HttpError(404, `${what} no encontrado`);

/* ---------- validación ---------- */
function str(v, name, { max = 200, required = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw bad(`${name} no es válido`);
  v = v.trim();
  if (required && !v) throw bad(`${name} es obligatorio`);
  if (v.length > max) throw bad(`${name} es demasiado largo (máx. ${max})`);
  return v;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function time(v, name) {
  if (typeof v !== 'string' || !TIME_RE.test(v)) throw bad(`${name} debe tener formato HH:MM`);
  return v;
}
function color(v) {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw bad('El color no es válido');
  return v.toLowerCase();
}
function int(v, name, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} no es válido`);
  return n;
}
function isoDate(v, name) {
  const d = typeof v === 'string' ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) throw bad(`${name} no es una fecha válida`);
  return d.toISOString();
}
function timezone(v) {
  try {
    new Intl.DateTimeFormat('es', { timeZone: v });
    return v;
  } catch {
    throw bad('La zona horaria no es válida');
  }
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const id = (v) => int(v, 'Identificador', 1, Number.MAX_SAFE_INTEGER);

/* ---------- sesiones ---------- */
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie mal formada: se ignora */
    }
  }
  return out;
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    timezone: u.timezone,
    visible_days: JSON.parse(u.visible_days),
    email_notifications: Boolean(u.email_notifications),
    default_reminder_minutes: u.default_reminder_minutes,
    daily_digest: Boolean(u.daily_digest),
    digest_hour: u.digest_hour,
  };
}

/* Limitador sencillo de intentos de inicio de sesión (en memoria). */
function createLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10000) for (const [k, e] of hits) if (e.reset < now) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

export function createApi({ db, mailer, appUrl = '' }) {
  const r = Router();
  const allowLogin = createLimiter(10, 15 * 60 * 1000);
  const allowRegister = createLimiter(20, 60 * 60 * 1000);
  const allowTestEmail = createLimiter(5, 60 * 60 * 1000);

  // Protección CSRF: toda petición que modifica datos debe ser JSON (los formularios
  // de otros sitios no pueden enviar ese tipo de contenido sin CORS).
  r.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !String(req.headers['content-type'] || '').startsWith('application/json')) {
      return next(new HttpError(415, 'Se esperaba JSON'));
    }
    next();
  });
  r.use(express.json({ limit: '200kb' }));

  // Comprobación de estado para Render (y para mantener despierto el plan gratuito).
  r.get('/health', async (req, res) => {
    await db.get('SELECT 1 AS ok');
    res.json({ ok: true });
  });
  r.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    next();
  });

  async function startSession(req, res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    (await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', hashToken(token), userId, Date.now() + SESSION_MS));
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: SESSION_MS, path: '/' });
  }

  r.use(async (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) {
      req.sessionHash = hashToken(token);
      req.user = await db.get('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', req.sessionHash, Date.now());
    }
    next();
  });

  /* ---------- autenticación ---------- */
  r.post('/auth/register', async (req, res) => {
    if (!allowRegister(req.ip)) throw new HttpError(429, 'Demasiados registros. Inténtalo más tarde.');
    const name = str(req.body.name, 'El nombre', { max: 80, required: true });
    const email = str(req.body.email, 'El correo', { max: 191, required: true }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw bad('El correo no es válido');
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres');
    if (password.length > 200) throw bad('La contraseña es demasiado larga');
    let tz = 'Europe/Madrid';
    if (req.body.timezone) {
      try {
        tz = timezone(req.body.timezone);
      } catch {
        /* se usa la zona por defecto */
      }
    }
    if ((await db.get('SELECT 1 FROM users WHERE email = ?', email))) throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    const hash = await bcrypt.hash(password, 10);
    const userId = await db.tx(async (t) => {
      const { insertId } = await t.run(
        'INSERT INTO users (name, email, password_hash, timezone, created_at) VALUES (?, ?, ?, ?, ?)',
        name, email, hash, tz, new Date().toISOString()
      );
      for (const s of DEFAULT_SLOTS) {
        await t.run('INSERT INTO time_slots (user_id, start_time, end_time, label, is_break) VALUES (?, ?, ?, ?, ?)', insertId, ...s);
      }
      return insertId;
    });
    await startSession(req, res, userId);
    res.status(201).json({ user: publicUser((await db.get('SELECT * FROM users WHERE id = ?', userId))) });
  });

  r.post('/auth/login', async (req, res) => {
    const email = str(req.body.email, 'El correo', { max: 254, required: true }).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!allowLogin(`${req.ip}|${email}`)) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
    const user = (await db.get('SELECT * FROM users WHERE email = ?', email));
    if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new HttpError(401, 'Correo o contraseña incorrectos');
    await startSession(req, res, user.id);
    res.json({ user: publicUser(user) });
  });

  r.post('/auth/logout', async (req, res) => {
    if (req.sessionHash) (await db.run('DELETE FROM sessions WHERE token_hash = ?', req.sessionHash));
    res.clearCookie(COOKIE, { path: '/' });
    res.status(204).end();
  });

  // A partir de aquí, todo requiere sesión iniciada.
  r.use((req, res, next) => (req.user ? next() : next(new HttpError(401, 'Inicia sesión para continuar'))));
  const uid = (req) => req.user.id;

  /* ---------- usuario y ajustes ---------- */
  r.get('/me', async (req, res) => res.json({ user: publicUser(req.user), mail_configured: mailer.configured }));

  r.get('/bootstrap', async (req, res) => {
    res.json({
      user: publicUser(req.user),
      mail_configured: mailer.configured,
      subjects: (await db.all('SELECT id, name, short_name, color, room, teacher FROM subjects WHERE user_id = ? ORDER BY LOWER(name)', uid(req))),
      slots: await listSlots(uid(req)),
      schedule: await listSchedule(uid(req)),
    });
  });

  r.put('/me/settings', async (req, res) => {
    const u = req.user;
    const b = req.body;
    const next = {
      name: b.name !== undefined ? str(b.name, 'El nombre', { max: 80, required: true }) : u.name,
      timezone: b.timezone !== undefined ? timezone(b.timezone) : u.timezone,
      visible_days: u.visible_days,
      email_notifications: b.email_notifications !== undefined ? (b.email_notifications ? 1 : 0) : u.email_notifications,
      default_reminder_minutes:
        b.default_reminder_minutes !== undefined
          ? b.default_reminder_minutes === null
            ? null
            : int(b.default_reminder_minutes, 'El aviso por defecto', 0, 60 * 24 * 30)
          : u.default_reminder_minutes,
      daily_digest: b.daily_digest !== undefined ? (b.daily_digest ? 1 : 0) : u.daily_digest,
      digest_hour: b.digest_hour !== undefined ? int(b.digest_hour, 'La hora del resumen', 0, 23) : u.digest_hour,
    };
    if (b.visible_days !== undefined) {
      if (!Array.isArray(b.visible_days)) throw bad('Los días visibles no son válidos');
      const days = [...new Set(b.visible_days.map((d) => int(d, 'Día', 0, 6)))].sort();
      if (!days.length) throw bad('Selecciona al menos un día de la semana');
      next.visible_days = JSON.stringify(days);
    }
    const lastDigest = next.digest_hour !== u.digest_hour ? null : u.last_digest_date;
    (await db.run(`UPDATE users SET name = ?, timezone = ?, visible_days = ?, email_notifications = ?, default_reminder_minutes = ?,
       daily_digest = ?, digest_hour = ?, last_digest_date = ? WHERE id = ?`, next.name, next.timezone, next.visible_days, next.email_notifications, next.default_reminder_minutes, next.daily_digest, next.digest_hour, lastDigest, u.id));
    res.json({ user: publicUser((await db.get('SELECT * FROM users WHERE id = ?', u.id))) });
  });

  r.put('/me/password', async (req, res) => {
    const current = typeof req.body.current === 'string' ? req.body.current : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!(await bcrypt.compare(current, req.user.password_hash))) throw bad('La contraseña actual no es correcta');
    if (password.length < 8 || password.length > 200) throw bad('La nueva contraseña debe tener al menos 8 caracteres');
    const hash = await bcrypt.hash(password, 10);
    (await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, req.user.id));
    // Cierra las demás sesiones abiertas.
    (await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', req.user.id, req.sessionHash));
    res.status(204).end();
  });

  r.post('/me/test-email', async (req, res) => {
    if (!allowTestEmail(String(req.user.id))) throw new HttpError(429, 'Has enviado demasiados correos de prueba. Espera un rato.');
    try {
      await mailer.send({ to: req.user.email, ...testEmail(req.user, appUrl) });
    } catch (err) {
      throw new HttpError(502, `No se pudo enviar el correo: ${err.message}`);
    }
    res.json({ ok: true, mail_configured: mailer.configured });
  });

  /* ---------- asignaturas ---------- */
  function subjectInput(b) {
    return {
      name: str(b.name, 'El nombre de la asignatura', { max: 60, required: true }),
      short_name: str(b.short_name, 'La abreviatura', { max: 6 }),
      color: color(b.color ?? '#4f46e5'),
      room: str(b.room, 'El aula', { max: 60 }),
      teacher: str(b.teacher, 'El profesor', { max: 80 }),
    };
  }
  const getSubject = async (userId, subjectId) =>
    (await db.get('SELECT id, name, short_name, color, room, teacher FROM subjects WHERE id = ? AND user_id = ?', subjectId, userId));

  r.get('/subjects', async (req, res) => {
    res.json((await db.all('SELECT id, name, short_name, color, room, teacher FROM subjects WHERE user_id = ? ORDER BY LOWER(name)', uid(req))));
  });
  r.post('/subjects', async (req, res) => {
    const s = subjectInput(req.body);
    const { insertId } = await db.run('INSERT INTO subjects (user_id, name, short_name, color, room, teacher) VALUES (?, ?, ?, ?, ?, ?)', uid(req), s.name, s.short_name, s.color, s.room, s.teacher);
    res.status(201).json(await getSubject(uid(req), insertId));
  });
  r.put('/subjects/:id', async (req, res) => {
    const existing = await getSubject(uid(req), id(req.params.id));
    if (!existing) throw notFound('Asignatura');
    const s = subjectInput({ ...existing, ...req.body });
    (await db.run('UPDATE subjects SET name = ?, short_name = ?, color = ?, room = ?, teacher = ? WHERE id = ?', s.name, s.short_name, s.color, s.room, s.teacher, existing.id));
    res.json(await getSubject(uid(req), existing.id));
  });
  r.delete('/subjects/:id', async (req, res) => {
    const { changes } = (await db.run('DELETE FROM subjects WHERE id = ? AND user_id = ?', id(req.params.id), uid(req)));
    if (!changes) throw notFound('Asignatura');
    res.status(204).end();
  });

  /* ---------- tramos horarios ---------- */
  const listSlots = async (userId) =>
    (await db.all('SELECT id, start_time, end_time, label, is_break FROM time_slots WHERE user_id = ? ORDER BY start_time, end_time', userId)).map((s) => ({ ...s, is_break: Boolean(s.is_break) }));
  function slotInput(b) {
    const s = {
      start_time: time(b.start_time, 'La hora de inicio'),
      end_time: time(b.end_time, 'La hora de fin'),
      label: str(b.label, 'La etiqueta', { max: 40 }),
      is_break: b.is_break ? 1 : 0,
    };
    if (s.start_time >= s.end_time) throw bad('La hora de fin debe ser posterior a la de inicio');
    return s;
  }
  r.get('/slots', async (req, res) => res.json(await listSlots(uid(req))));
  r.post('/slots', async (req, res) => {
    const s = slotInput(req.body);
    if ((await db.get('SELECT COUNT(*) AS n FROM time_slots WHERE user_id = ?', uid(req))).n >= 30) throw bad('Máximo 30 tramos horarios');
    (await db.run('INSERT INTO time_slots (user_id, start_time, end_time, label, is_break) VALUES (?, ?, ?, ?, ?)', uid(req), s.start_time, s.end_time, s.label, s.is_break));
    res.status(201).json(await listSlots(uid(req)));
  });
  r.put('/slots/:id', async (req, res) => {
    const existing = (await db.get('SELECT * FROM time_slots WHERE id = ? AND user_id = ?', id(req.params.id), uid(req)));
    if (!existing) throw notFound('Tramo');
    const s = slotInput({ ...existing, ...req.body });
    (await db.run('UPDATE time_slots SET start_time = ?, end_time = ?, label = ?, is_break = ? WHERE id = ?', s.start_time, s.end_time, s.label, s.is_break, existing.id));
    res.json(await listSlots(uid(req)));
  });
  r.delete('/slots/:id', async (req, res) => {
    const { changes } = (await db.run('DELETE FROM time_slots WHERE id = ? AND user_id = ?', id(req.params.id), uid(req)));
    if (!changes) throw notFound('Tramo');
    res.json(await listSlots(uid(req)));
  });

  /* ---------- horario semanal ---------- */
  const listSchedule = async (userId) => (await db.all('SELECT id, subject_id, slot_id, day, room_override FROM schedule_entries WHERE user_id = ?', userId));
  r.get('/schedule', async (req, res) => res.json(await listSchedule(uid(req))));
  r.put('/schedule', async (req, res) => {
    const day = int(req.body.day, 'Día', 0, 6);
    const slotId = id(req.body.slot_id);
    if (!(await db.get('SELECT 1 FROM time_slots WHERE id = ? AND user_id = ?', slotId, uid(req)))) throw notFound('Tramo');
    if (req.body.subject_id === null || req.body.subject_id === undefined || req.body.subject_id === '') {
      (await db.run('DELETE FROM schedule_entries WHERE user_id = ? AND slot_id = ? AND day = ?', uid(req), slotId, day));
    } else {
      const subjectId = id(req.body.subject_id);
      if (!await getSubject(uid(req), subjectId)) throw notFound('Asignatura');
      const room = str(req.body.room_override, 'El aula', { max: 60 });
      await db.tx(async (t) => {
        await t.run('DELETE FROM schedule_entries WHERE user_id = ? AND slot_id = ? AND day = ?', uid(req), slotId, day);
        await t.run('INSERT INTO schedule_entries (user_id, subject_id, slot_id, day, room_override) VALUES (?, ?, ?, ?, ?)', uid(req), subjectId, slotId, day, room);
      });
    }
    res.json(await listSchedule(uid(req)));
  });

  /* ---------- tareas y exámenes ---------- */
  async function loadItem(userId, itemId) {
    const item = (await db.get(`${ITEM_SELECT} WHERE i.id = ? AND i.user_id = ?`, itemId, userId));
    return item ? serializeItem((await attachChecklists(db, [item]))[0]) : null;
  }
  async function itemInput(userId, b) {
    const item = {
      type: b.type === 'exam' ? 'exam' : b.type === 'task' ? 'task' : null,
      title: str(b.title, 'El título', { max: 150, required: true }),
      description: str(b.description, 'La descripción', { max: 5000 }),
      subject_id: b.subject_id === null || b.subject_id === undefined || b.subject_id === '' ? null : id(b.subject_id),
      due_at: isoDate(b.due_at, 'La fecha'),
      reminder_minutes: b.reminder_minutes === null || b.reminder_minutes === undefined || b.reminder_minutes === '' ? null : int(b.reminder_minutes, 'El aviso', 0, 60 * 24 * 30),
      done: b.done ? 1 : 0,
    };
    if (!item.type) throw bad('El tipo debe ser tarea o examen');
    if (item.subject_id && !await getSubject(userId, item.subject_id)) throw notFound('Asignatura');
    return item;
  }
  function checklistInput(list) {
    if (list === undefined) return undefined;
    if (!Array.isArray(list) || list.length > 100) throw bad('La lista de comprobación no es válida');
    return list
      .map((c) => ({ text: str(c?.text, 'El elemento de la lista', { max: 200 }), done: c?.done ? 1 : 0 }))
      .filter((c) => c.text);
  }
  async function saveChecklist(t, itemId, list) {
    await t.run('DELETE FROM checklist_items WHERE item_id = ?', itemId);
    for (const [i, c] of list.entries()) {
      await t.run('INSERT INTO checklist_items (item_id, text, done, position) VALUES (?, ?, ?, ?)', itemId, c.text, c.done, i);
    }
  }

  r.get('/items', async (req, res) => {
    const where = ['i.user_id = ?'];
    const params = [uid(req)];
    if (req.query.from) (where.push('i.due_at >= ?'), params.push(isoDate(req.query.from, 'Desde')));
    if (req.query.to) (where.push('i.due_at <= ?'), params.push(isoDate(req.query.to, 'Hasta')));
    if (req.query.status === 'pending') where.push('i.done = 0');
    if (req.query.status === 'done') where.push('i.done = 1');
    if (req.query.type === 'task' || req.query.type === 'exam') (where.push('i.type = ?'), params.push(req.query.type));
    const items = (await db.all(`${ITEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.due_at, i.id`, ...params));
    res.json((await attachChecklists(db, items)).map(serializeItem));
  });

  r.post('/items', async (req, res) => {
    const item = await itemInput(uid(req), req.body);
    const checklist = checklistInput(req.body.checklist) || [];
    const now = new Date().toISOString();
    const itemId = await db.tx(async (t) => {
      const { insertId } = await t.run(
        'INSERT INTO items (user_id, type, title, description, subject_id, due_at, reminder_minutes, done, done_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        uid(req), item.type, item.title, item.description, item.subject_id, item.due_at, item.reminder_minutes, item.done, item.done ? now : null, now
      );
      await saveChecklist(t, insertId, checklist);
      return insertId;
    });
    res.status(201).json(await loadItem(uid(req), itemId));
  });

  r.put('/items/:id', async (req, res) => {
    const existing = await loadItem(uid(req), id(req.params.id));
    if (!existing) throw notFound('Tarea');
    const item = await itemInput(uid(req), { ...existing, ...req.body });
    const checklist = checklistInput(req.body.checklist);
    const resetReminder = item.due_at !== existing.due_at || item.reminder_minutes !== existing.reminder_minutes;
    const doneAt = item.done ? (existing.done ? existing.done_at : new Date().toISOString()) : null;
    await db.tx(async (t) => {
      await t.run(
        `UPDATE items SET type = ?, title = ?, description = ?, subject_id = ?, due_at = ?, reminder_minutes = ?, done = ?, done_at = ?,
         reminder_sent_at = CASE WHEN ? = 1 THEN NULL ELSE reminder_sent_at END WHERE id = ?`,
        item.type, item.title, item.description, item.subject_id, item.due_at, item.reminder_minutes, item.done, doneAt, resetReminder ? 1 : 0, existing.id
      );
      if (checklist) await saveChecklist(t, existing.id, checklist);
    });
    res.json(await loadItem(uid(req), existing.id));
  });

  r.delete('/items/:id', async (req, res) => {
    const { changes } = (await db.run('DELETE FROM items WHERE id = ? AND user_id = ?', id(req.params.id), uid(req)));
    if (!changes) throw notFound('Tarea');
    res.status(204).end();
  });

  r.patch('/checklist/:id', async (req, res) => {
    const row = await db.get('SELECT c.*, i.id AS item_id FROM checklist_items c JOIN items i ON i.id = c.item_id WHERE c.id = ? AND i.user_id = ?', id(req.params.id), uid(req));
    if (!row) throw notFound('Elemento de la lista');
    const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : row.done;
    const text = req.body.text !== undefined ? str(req.body.text, 'El texto', { max: 200, required: true }) : row.text;
    (await db.run('UPDATE checklist_items SET done = ?, text = ? WHERE id = ?', done, text, row.id));
    res.json(await loadItem(uid(req), row.item_id));
  });

  /* ---------- errores ---------- */
  r.use((req, res, next) => next(new HttpError(404, 'Ruta no encontrada')));
  // eslint-disable-next-line no-unused-vars
  r.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = bad('JSON no válido');
    const status = err.status || 500;
    if (status >= 500 && status !== 502) console.error(err);
    res.status(status).json({ error: status >= 500 && status !== 502 ? 'Error interno del servidor' : err.message });
  });

  return r;
}
