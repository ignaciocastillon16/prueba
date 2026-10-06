import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, dbConfigFromEnv } from '../src/db.js';
import { createApp } from '../src/server.js';
import { createScheduler } from '../src/scheduler.js';
import { createPusher, loadVapidKeys } from '../src/push.js';

const sent = [];
const mailer = { configured: true, async send(msg) { sent.push(msg); } };
// Por defecto se prueba con SQLite en memoria. Con TEST_DATABASE_URL=mysql://… se prueba contra MySQL.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const { default: mysql } = await import('mysql2/promise');
  const conn = await mysql.createConnection(testUrl);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['events', 'timetables', 'push_subscriptions', 'app_settings', 'checklist_items', 'items', 'schedule_entries', 'subjects', 'time_slots', 'sessions', 'users']) await conn.query(`DROP TABLE IF EXISTS ${t}`);
  await conn.end();
}
const db = await openDb(testUrl ? dbConfigFromEnv({ DATABASE_URL: testUrl }) : { file: ':memory:' });
// Envío push simulado: guarda los mensajes; un endpoint con «caducado» responde 410 como haría el servicio real.
const pushed = [];
const fakeSend = async (sub, payload, opts) => {
  if (sub.endpoint.includes('caducado')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
  pushed.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), opts });
};
const keys = await loadVapidKeys(db, {});
const pusher = createPusher({ db, keys, subject: 'mailto:test@example.com', send: fakeSend, logger: { error() {} } });
let server;
let base;

before(async () => {
  server = createApp({ db, mailer, pusher, appUrl: 'http://test' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.close();
  await db.close();
});

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + '/api' + url, {
      method,
      headers: { ...(cookie && { cookie }), ...(method !== 'GET' && { 'content-type': 'application/json' }) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
}

test('registro, sesión y aislamiento entre usuarios', async () => {
  const ana = client();
  assert.equal((await ana('GET', '/me')).status, 401);
  assert.equal((await ana('POST', '/auth/register', { name: 'Ana', email: 'ana@x.com', password: 'corta' })).status, 400);
  const reg = await ana('POST', '/auth/register', { name: 'Ana', email: 'Ana@X.com', password: 'secreto123', timezone: 'Europe/Madrid' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'ana@x.com');
  assert.deepEqual(reg.body.user.visible_days, [1, 2, 3, 4, 5]);
  assert.equal((await ana('POST', '/auth/register', { name: 'Ana', email: 'ana@x.com', password: 'secreto123' })).status, 409);

  const boot = await ana('GET', '/bootstrap');
  assert.equal(boot.body.slots.length, 7);
  assert.ok(boot.body.slots.some((s) => s.is_break));

  const subj = await ana('POST', '/subjects', { name: 'Matemáticas', color: '#FF0000', room: 'B-12', teacher: 'Sr. Pérez' });
  assert.equal(subj.status, 201);
  assert.equal(subj.body.color, '#ff0000');

  const luis = client();
  assert.equal((await luis('POST', '/auth/login', { email: 'ana@x.com', password: 'mala' })).status, 401);
  await luis('POST', '/auth/register', { name: 'Luis', email: 'luis@x.com', password: 'secreto123' });
  assert.equal((await luis('PUT', `/subjects/${subj.body.id}`, { name: 'Hack' })).status, 404);
  assert.equal((await luis('GET', '/subjects')).body.length, 0);
  assert.equal((await luis('POST', '/items', { type: 'task', title: 'x', due_at: new Date().toISOString(), subject_id: subj.body.id })).status, 404);

  const relog = client();
  assert.equal((await relog('POST', '/auth/login', { email: 'ANA@x.com', password: 'secreto123' })).status, 200);
  await relog('POST', '/auth/logout');
  assert.equal((await relog('GET', '/me')).status, 401);
});

test('ajustes: días visibles, tramos y horario semanal', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Eva', email: 'eva@x.com', password: 'secreto123' });
  assert.equal((await c('PUT', '/me/settings', { visible_days: [] })).status, 400);
  const s = await c('PUT', '/me/settings', { visible_days: [6, 1, 1, 3], digest_hour: 8, daily_digest: true });
  assert.deepEqual(s.body.user.visible_days, [1, 3, 6]);
  assert.equal(s.body.user.daily_digest, true);
  assert.equal(s.body.user.tt_background, 'rayas');
  assert.equal((await c('PUT', '/me/settings', { tt_background: 'menta' })).body.user.tt_background, 'menta');
  assert.equal((await c('PUT', '/me/settings', { tt_background: 'inventado' })).status, 400);

  assert.equal((await c('POST', '/slots', { start_time: '15:00', end_time: '14:00' })).status, 400);
  const slots = (await c('POST', '/slots', { start_time: '14:00', end_time: '14:55', label: '7ª' })).body;
  assert.equal(slots.length, 8);
  assert.equal(slots.at(-1).start_time, '14:00');

  const subj = (await c('POST', '/subjects', { name: 'Historia', color: '#00aa00' })).body;
  const slotId = slots[0].id;
  let sched = (await c('PUT', '/schedule', { slot_id: slotId, day: 1, subject_id: subj.id, room_override: 'Lab' })).body;
  assert.equal(sched.length, 1);
  sched = (await c('PUT', '/schedule', { slot_id: slotId, day: 1, subject_id: subj.id, room_override: '' })).body;
  assert.equal(sched.length, 1);
  assert.equal(sched[0].room_override, '');
  sched = (await c('PUT', '/schedule', { slot_id: slotId, day: 1, subject_id: null })).body;
  assert.equal(sched.length, 0);

  await c('PUT', '/schedule', { slot_id: slotId, day: 2, subject_id: subj.id });
  await c('DELETE', `/subjects/${subj.id}`);
  assert.equal((await c('GET', '/schedule')).body.length, 0);
});

test('tareas y exámenes con checklist', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Leo', email: 'leo@x.com', password: 'secreto123' });
  const subj = (await c('POST', '/subjects', { name: 'Física', color: '#123456' })).body;
  const created = await c('POST', '/items', {
    type: 'exam', title: 'Examen tema 2', subject_id: subj.id, due_at: '2026-11-10T08:00:00.000Z', reminder_minutes: 1440,
    checklist: [{ text: 'Repasar fórmulas' }, { text: '  ' }, { text: 'Hacer problemas', done: true }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.checklist.length, 2);
  assert.equal(created.body.checklist[1].done, true);

  const toggled = await c('PATCH', `/checklist/${created.body.checklist[0].id}`, { done: true });
  assert.ok(toggled.body.checklist.every((x) => x.done));

  const done = await c('PUT', `/items/${created.body.id}`, { done: true });
  assert.equal(done.body.done, true);
  assert.ok(done.body.done_at);
  assert.equal(done.body.checklist.length, 2, 'la checklist no cambia si no se envía');

  assert.equal((await c('GET', '/items?status=pending')).body.length, 0);
  assert.equal((await c('GET', '/items?from=2026-11-01T00:00:00Z&to=2026-11-30T00:00:00Z')).body.length, 1);
  assert.equal((await c('POST', '/items', { type: 'otro', title: 'x', due_at: '2026-01-01T00:00:00Z' })).status, 400);
  assert.equal((await c('POST', '/items', { type: 'task', title: 'x', due_at: 'mañana' })).status, 400);
  assert.equal((await c('DELETE', `/items/${created.body.id}`)).status, 204);
});

test('protección CSRF: rechaza peticiones que no son JSON', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
  assert.equal(res.status, 415);
});

test('avisos por correo y resumen diario', async () => {
  const c = client();
  const user = (await c('POST', '/auth/register', { name: 'Mar', email: 'mar@x.com', password: 'secreto123', timezone: 'Europe/Madrid' })).body.user;
  const now = new Date('2026-10-05T10:00:00Z');
  const scheduler = createScheduler({ db, mailer, appUrl: 'http://test', logger: { log() {}, error: console.error } });
  const mk = (title, dueMs, reminder, extra = {}) =>
    c('POST', '/items', { type: 'task', title, due_at: new Date(now.getTime() + dueMs).toISOString(), reminder_minutes: reminder, ...extra });

  await mk('Pronto', 30 * 60000, 60, { checklist: [{ text: 'Paso <1>' }] }); // aviso ya toca
  await mk('Lejos', 3 * 86400000, 1440); // aún no
  await mk('Sin aviso', 10 * 60000, null);
  await mk('Hecha', 10 * 60000, 60, { done: true });
  await mk('Pasada', -3600000, 60); // ya pasó: no se avisa
  const exam = (await mk('Examen', 20 * 60000, 60, { type: 'exam' })).body;

  sent.length = 0;
  await scheduler.tick(now);
  const isReminder = (m) => m.subject.startsWith('Recordatorio: ');
  const toMar = sent.filter((m) => m.to === 'mar@x.com' && isReminder(m));
  assert.deepEqual(toMar.map((m) => m.subject.replace(/^Recordatorio: /, '').replace(/ \(.*\)$/, '')).sort(), ['Examen', 'Pronto']);
  assert.ok(toMar.find((m) => m.subject.includes('Pronto')).html.includes('Paso &lt;1&gt;'));

  sent.length = 0;
  await scheduler.tick(now);
  assert.equal(sent.filter(isReminder).length, 0, 'no se repiten avisos');

  // Cambiar la fecha reprograma el aviso.
  await c('PUT', `/items/${exam.id}`, { due_at: new Date(now.getTime() + 40 * 60000).toISOString() });
  await scheduler.tick(now);
  assert.equal(sent.filter((m) => m.subject.includes('Examen')).length, 1);

  // Avisos desactivados.
  await c('PUT', '/me/settings', { email_notifications: false });
  await mk('Silencio', 5 * 60000, 15);
  sent.length = 0;
  await scheduler.tick(now);
  assert.equal(sent.filter((m) => m.to === 'mar@x.com').length, 0);

  // Resumen diario a las 12:00 hora de Madrid (10:00 UTC).
  await c('PUT', '/me/settings', { email_notifications: true, daily_digest: true, digest_hour: 12 });
  sent.length = 0;
  await scheduler.tick(now);
  const digest = sent.filter((m) => m.to === 'mar@x.com' && m.subject.startsWith('Tu resumen'));
  assert.equal(digest.length, 1);
  assert.match(digest[0].text, /Lejos/);
  sent.length = 0;
  await scheduler.tick(now);
  assert.equal(sent.filter((m) => m.subject.startsWith('Tu resumen') && m.to === 'mar@x.com').length, 0, 'un resumen al día');
  assert.equal(user.email, 'mar@x.com');
});

test('correo de prueba', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Sol', email: 'sol@x.com', password: 'secreto123' });
  sent.length = 0;
  const r = await c('POST', '/me/test-email');
  assert.equal(r.status, 200);
  assert.equal(sent[0].to, 'sol@x.com');
});

test('ruta de salud', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('notificaciones push', async () => {
  // Las claves VAPID se guardan y se reutilizan
  assert.equal((await loadVapidKeys(db, {})).publicKey, keys.publicKey);

  const c = client();
  await c('POST', '/auth/register', { name: 'Pau', email: 'pau@x.com', password: 'secreto123', timezone: 'Europe/Madrid' });
  assert.equal((await c('GET', '/push/key')).body.publicKey, keys.publicKey);
  assert.equal((await c('POST', '/push/test')).status, 400, 'sin dispositivos');
  assert.equal((await c('POST', '/push/subscribe', { subscription: { endpoint: 'http://inseguro', keys: { p256dh: 'a', auth: 'b' } } })).status, 400);

  const sub = (endpoint) => ({ subscription: { endpoint, keys: { p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', auth: 'tBHItJI5svbpez7KI4CCXg' } } });
  assert.equal((await c('POST', '/push/subscribe', sub('https://push.example.com/movil'))).body.push_devices, 1);
  assert.equal((await c('POST', '/push/subscribe', sub('https://push.example.com/movil'))).body.push_devices, 1, 'no se duplica');
  await c('POST', '/push/subscribe', sub('https://push.example.com/caducado'));
  assert.equal((await c('GET', '/me')).body.push_devices, 2);

  pushed.length = 0;
  const t = await c('POST', '/push/test');
  assert.equal(t.status, 200);
  assert.equal(t.body.sent, 1);
  assert.equal(t.body.push_devices, 1, 'el dispositivo caducado se borra');
  assert.equal(pushed[0].payload.title, 'Horaria');
  assert.equal(pushed[0].opts.vapidDetails.publicKey, keys.publicKey);

  // Otro usuario no puede borrar la suscripción ajena
  const otro = client();
  await otro('POST', '/auth/register', { name: 'Otro', email: 'otro@x.com', password: 'secreto123' });
  await otro('POST', '/push/unsubscribe', { endpoint: 'https://push.example.com/movil' });
  assert.equal((await c('GET', '/me')).body.push_devices, 1);

  // Recordatorio solo por push (correo desactivado)
  await c('PUT', '/me/settings', { email_notifications: false });
  const now = new Date('2026-10-05T10:00:00Z');
  await c('POST', '/items', { type: 'exam', title: 'Examen push', due_at: new Date(now.getTime() + 30 * 60000).toISOString(), reminder_minutes: 60 });
  sent.length = 0;
  pushed.length = 0;
  const scheduler = createScheduler({ db, mailer, pusher, appUrl: 'http://test', logger: { log() {}, error() {} } });
  await scheduler.tick(now);
  assert.equal(sent.filter((m) => m.to === 'pau@x.com').length, 0, 'sin correo');
  const mine = pushed.filter((p) => p.endpoint.endsWith('/movil'));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].payload.title, 'Examen push');
  assert.match(mine[0].payload.body, /^Examen, dentro de 30 minutos/);
  pushed.length = 0;
  await scheduler.tick(now);
  assert.equal(pushed.filter((p) => p.endpoint.endsWith('/movil')).length, 0, 'no se repite');

  // Al darse de baja, deja de recibir
  await c('POST', '/push/unsubscribe', { endpoint: 'https://push.example.com/movil' });
  assert.equal((await c('GET', '/me')).body.push_devices, 0);
});

test('varios horarios', async () => {
  const c = client();
  const reg = await c('POST', '/auth/register', { name: 'Iris', email: 'iris@x.com', password: 'secreto123' });
  const boot = (await c('GET', '/bootstrap')).body;
  assert.equal(boot.timetables.length, 1);
  assert.equal(boot.timetables[0].name, 'Mi horario');
  const tt1 = boot.timetables[0].id;
  assert.equal(reg.body.user.active_timetable_id, tt1);
  assert.ok(boot.slots.every((s) => s.timetable_id === tt1));

  const subj = (await c('POST', '/subjects', { name: 'Arte', color: '#aa3366' })).body;
  await c('PUT', '/schedule', { slot_id: boot.slots[0].id, day: 1, subject_id: subj.id, room_override: 'T1' });

  assert.equal((await c('POST', '/timetables', { name: 'Malo', start_date: '2027-13-01' })).status, 400);
  assert.equal((await c('POST', '/timetables', { name: 'Malo', start_date: '2027-06-01', end_date: '2027-02-01' })).status, 400);

  const copy = await c('POST', '/timetables', { name: '2º cuatrimestre', copy_from: tt1, start_date: '2027-02-01', end_date: '2027-06-30' });
  assert.equal(copy.status, 201);
  const tt2 = copy.body.id;
  assert.equal(copy.body.user.active_timetable_id, tt2, 'el nuevo queda activo');
  const slots2 = copy.body.slots.filter((s) => s.timetable_id === tt2);
  assert.equal(slots2.length, 7, 'copia los tramos');
  const copied = copy.body.schedule.find((e) => slots2.some((s) => s.id === e.slot_id));
  const subj2 = copy.body.subjects.find((x) => x.timetable_id === tt2);
  assert.ok(subj2, 'copia las asignaturas');
  assert.notEqual(subj2.id, subj.id, 'como asignaturas propias del nuevo horario');
  assert.equal(subj2.name, 'Arte');
  assert.equal(copied.subject_id, subj2.id, 'las clases copiadas usan la asignatura copiada');
  assert.equal(copied.room_override, 'T1');
  assert.equal(copy.body.subjects.find((x) => x.id === subj.id).timetable_id, tt1, 'la original sigue en su horario');
  // Las asignaturas nuevas van al horario abierto y no se pueden mezclar entre horarios
  const own2 = (await c('POST', '/subjects', { name: 'Solo del 2º', color: '#335577' })).body;
  assert.equal(own2.timetable_id, tt2);
  assert.equal((await c('PUT', '/schedule', { slot_id: slots2[0].id, day: 3, subject_id: subj.id })).status, 400, 'asignatura de otro horario');
  assert.equal((await c('PUT', '/schedule', { slot_id: slots2[0].id, day: 3, subject_id: own2.id })).status, 200);
  // Una tarea con una asignatura del horario que se va a borrar
  const task = (await c('POST', '/items', { type: 'task', title: 'Con asignatura del 2º', due_at: '2027-03-01T10:00:00Z', subject_id: own2.id })).body;
  assert.equal(copy.body.timetables.find((t) => t.id === tt2).start_date, '2027-02-01');

  const empty = await c('POST', '/timetables', { name: 'Vacío' });
  assert.equal(empty.body.slots.filter((s) => s.timetable_id === empty.body.id).length, 7, 'tramos por defecto');
  assert.equal(empty.body.schedule.filter((e) => empty.body.slots.some((s) => s.id === e.slot_id && s.timetable_id === empty.body.id)).length, 0);

  const upd = await c('PUT', `/timetables/${tt2}`, { name: '2º cuatri', background: 'menta' });
  assert.equal(upd.body.find((t) => t.id === tt2).background, 'menta');
  assert.equal((await c('PUT', `/timetables/${tt2}`, { background: 'otro' })).status, 400);

  const added = (await c('POST', '/slots', { timetable_id: tt2, start_time: '15:00', end_time: '16:00' })).body;
  assert.equal(added.filter((s) => s.timetable_id === tt2).length, 8);
  assert.equal(added.filter((s) => s.timetable_id === tt1).length, 7, 'no toca el otro horario');

  // Aislamiento entre usuarios
  const otro = client();
  await otro('POST', '/auth/register', { name: 'Otro', email: 'otro-tt@x.com', password: 'secreto123' });
  assert.equal((await otro('PUT', `/timetables/${tt2}`, { name: 'x' })).status, 404);
  assert.equal((await otro('DELETE', `/timetables/${tt2}`)).status, 404);
  assert.equal((await otro('POST', '/timetables', { name: 'x', copy_from: tt2 })).status, 404);
  assert.equal((await otro('PUT', '/me/settings', { active_timetable_id: tt2 })).status, 404);
  assert.equal((await otro('POST', '/slots', { timetable_id: tt2, start_time: '15:00', end_time: '16:00' })).status, 404);

  // Cambiar el activo y borrar
  assert.equal((await c('PUT', '/me/settings', { active_timetable_id: tt2 })).body.user.active_timetable_id, tt2);
  const del = await c('DELETE', `/timetables/${tt2}`);
  assert.equal(del.status, 200);
  assert.notEqual(del.body.user.active_timetable_id, tt2);
  assert.equal(del.body.slots.filter((s) => s.timetable_id === tt2).length, 0);
  assert.equal(del.body.schedule.filter((e) => slots2.some((s) => s.id === e.slot_id)).length, 0, 'borra sus clases');
  assert.equal(del.body.subjects.filter((x) => x.timetable_id === tt2).length, 0, 'borra sus asignaturas');
  const kept = (await c('GET', '/items')).body.find((i) => i.id === task.id);
  assert.ok(kept, 'la tarea se conserva');
  assert.equal(kept.subject_id, null, 'sin asignatura');
  await c('DELETE', `/timetables/${empty.body.id}`);
  assert.equal((await c('DELETE', `/timetables/${tt1}`)).status, 400, 'no se borra el único');
});

test('migración: los datos antiguos pasan a «Mi horario»', async () => {
  if (process.env.TEST_DATABASE_URL) return;
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'horaria-')), 'antigua.db');
  let old = await openDb({ file });
  // Simula un usuario de la versión anterior: tramos sin horario y sin horario activo
  const u = await old.run("INSERT INTO users (name, email, password_hash, created_at, tt_background) VALUES ('Vieja', 'v@x.com', 'x', '2026-01-01', 'puntos')");
  await old.run('DELETE FROM timetables WHERE user_id = ?', u.insertId);
  await old.run("INSERT INTO time_slots (user_id, start_time, end_time, label) VALUES (?, '08:00', '09:00', '1')", u.insertId);
  await old.close();
  // Primer arranque: crea «Mi horario». Luego se simula un segundo horario que comparte asignatura (versión anterior).
  old = await openDb({ file });
  const tt1 = (await old.get('SELECT id FROM timetables WHERE user_id = ?', u.insertId)).id;
  const tt2 = (await old.run("INSERT INTO timetables (user_id, name, created_at) VALUES (?, 'Segundo', '2026-01-01')", u.insertId)).insertId;
  const shared = (await old.run("INSERT INTO subjects (user_id, name, color) VALUES (?, 'Compartida', '#123456')", u.insertId)).insertId;
  await old.run('UPDATE subjects SET timetable_id = NULL WHERE id = ?', shared);
  const slA = (await old.get('SELECT id FROM time_slots WHERE timetable_id = ?', tt1)).id;
  const slB = (await old.run("INSERT INTO time_slots (user_id, timetable_id, start_time, end_time) VALUES (?, ?, '10:00', '11:00')", u.insertId, tt2)).insertId;
  await old.run('INSERT INTO schedule_entries (user_id, subject_id, slot_id, day) VALUES (?, ?, ?, 1)', u.insertId, shared, slA);
  await old.run('INSERT INTO schedule_entries (user_id, subject_id, slot_id, day) VALUES (?, ?, ?, 1)', u.insertId, shared, slB);
  await old.close();
  old = await openDb({ file });
  const tts = await old.all('SELECT * FROM timetables WHERE user_id = ?', u.insertId);
  assert.equal(tts.length, 2);
  assert.equal(tts[0].name, 'Mi horario');
  assert.equal(tts[0].background, 'puntos', 'conserva el fondo elegido');
  assert.equal((await old.get('SELECT timetable_id FROM time_slots WHERE user_id = ?', u.insertId)).timetable_id, tts[0].id);
  assert.equal((await old.get('SELECT active_timetable_id FROM users WHERE id = ?', u.insertId)).active_timetable_id, tts[0].id);
  assert.ok(tts.every((t) => t.visible_days), 'los horarios reciben días');
  const subs = await old.all("SELECT * FROM subjects WHERE user_id = ? AND name = 'Compartida' ORDER BY id", u.insertId);
  assert.equal(subs.length, 2, 'la asignatura compartida se reparte en dos');
  assert.deepEqual(subs.map((x) => x.timetable_id).sort(), [tts[0].id, tts[1].id].sort());
  const entryB = await old.get('SELECT subject_id FROM schedule_entries WHERE slot_id = ?', slB);
  assert.equal(subs.find((x) => x.id === entryB.subject_id).timetable_id, tt2, 'cada clase apunta a la asignatura de su horario');
  await old.close();
  old = await openDb({ file });
  assert.equal((await old.all('SELECT * FROM timetables WHERE user_id = ?', u.insertId)).length, 2, 'no se duplica al volver a arrancar');
  assert.equal((await old.all("SELECT * FROM subjects WHERE name = 'Compartida'")).length, 2, 'ni las asignaturas');
  await old.close();
});

test('subasignaturas', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Sara', email: 'sara@x.com', password: 'secreto123', timezone: 'Europe/Madrid' });
  const boot = (await c('GET', '/bootstrap')).body;
  const tt1 = boot.timetables[0].id;
  const fyq = (await c('POST', '/subjects', { name: 'Física y Química', short_name: 'FyQ', color: '#7461a6', room: 'B-12', teacher: 'Marta' })).body;
  const quim = await c('POST', '/subjects', { name: 'Química', short_name: 'QUI', parent_id: fyq.id });
  assert.equal(quim.status, 201);
  assert.equal(quim.body.parent_id, fyq.id);
  assert.equal(quim.body.timetable_id, tt1, 'hereda el horario');
  assert.equal(quim.body.color, '#7461a6', 'hereda el color si no se indica');
  const lab = (await c('POST', '/subjects', { name: 'Laboratorio', parent_id: fyq.id, room: 'Lab 1', color: '#3f8c66' })).body;
  assert.equal((await c('POST', '/subjects', { name: 'Nieta', parent_id: quim.body.id })).status, 400, 'un solo nivel');
  const otro = client();
  await otro('POST', '/auth/register', { name: 'Otro', email: 'otro-sub@x.com', password: 'secreto123' });
  assert.equal((await otro('POST', '/subjects', { name: 'x', parent_id: fyq.id })).status, 404);

  // En el horario y en una tarea
  const slot = boot.slots[0];
  assert.equal((await c('PUT', '/schedule', { slot_id: slot.id, day: 2, subject_id: lab.id })).status, 200);
  const now = new Date('2026-10-05T10:00:00Z');
  const exam = (await c('POST', '/items', { type: 'exam', title: 'Formulación', subject_id: quim.body.id, due_at: new Date(now.getTime() + 20 * 60000).toISOString(), reminder_minutes: 60 })).body;
  assert.equal(exam.subject_id, quim.body.id);
  sent.length = 0;
  await createScheduler({ db, mailer, appUrl: 'http://test', logger: { log() {}, error() {} } }).tick(now);
  const mail = sent.find((m) => m.to === 'sara@x.com');
  assert.match(mail.text, /Física y Química · Química/, 'el aviso muestra asignatura y subasignatura');
  assert.match(mail.text, /Aula: B-12/, 'aula heredada de la asignatura principal');

  // Copiar el horario copia también las subasignaturas con su nueva asignatura principal
  const copy = (await c('POST', '/timetables', { name: 'Copia', copy_from: tt1 })).body;
  const fyq2 = copy.subjects.find((s) => s.timetable_id === copy.id && s.name === 'Física y Química');
  const subs2 = copy.subjects.filter((s) => s.parent_id === fyq2.id).map((s) => s.name).sort();
  assert.deepEqual(subs2, ['Laboratorio', 'Química']);
  const slot2 = copy.slots.find((s) => s.timetable_id === copy.id && s.start_time === slot.start_time);
  const entry2 = copy.schedule.find((e) => e.slot_id === slot2.id && e.day === 2);
  assert.equal(copy.subjects.find((s) => s.id === entry2.subject_id).name, 'Laboratorio');
  assert.notEqual(entry2.subject_id, lab.id, 'apunta a la copia');

  // Borrar la asignatura principal borra sus subasignaturas; la tarea se conserva sin asignatura
  assert.equal((await c('DELETE', `/subjects/${fyq.id}`)).status, 204);
  const left = (await c('GET', '/subjects')).body.filter((s) => s.timetable_id === tt1);
  assert.equal(left.length, 0);
  assert.equal((await c('GET', '/items')).body.find((i) => i.id === exam.id).subject_id, null);
  assert.equal((await c('GET', '/schedule')).body.filter((e) => e.slot_id === slot.id).length, 0);
});

test('cada horario tiene sus propios días', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Dani', email: 'dani@x.com', password: 'secreto123' });
  const tt1 = (await c('GET', '/bootstrap')).body.timetables[0];
  assert.deepEqual(tt1.visible_days, [1, 2, 3, 4, 5]);
  const copy = (await c('POST', '/timetables', { name: 'Sábados', copy_from: tt1.id })).body;
  assert.deepEqual(copy.timetables.find((t) => t.id === copy.id).visible_days, [1, 2, 3, 4, 5], 'la copia hereda los días');
  const upd = (await c('PUT', `/timetables/${copy.id}`, { visible_days: [6, 1, 6] })).body;
  assert.deepEqual(upd.find((t) => t.id === copy.id).visible_days, [1, 6]);
  assert.deepEqual(upd.find((t) => t.id === tt1.id).visible_days, [1, 2, 3, 4, 5], 'el otro horario no cambia');
  assert.equal((await c('PUT', `/timetables/${copy.id}`, { visible_days: [] })).status, 400);
  assert.equal((await c('PUT', `/timetables/${copy.id}`, { visible_days: [9] })).status, 400);
  const nuevo = (await c('POST', '/timetables', { name: 'Fin de semana', visible_days: [6, 0] })).body;
  assert.deepEqual(nuevo.timetables.find((t) => t.id === nuevo.id).visible_days, [0, 6]);
});

test('eventos', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Eva', email: 'eva-ev@x.com', password: 'secreto123', timezone: 'Europe/Madrid' });
  assert.equal((await c('POST', '/events', { title: '', start_at: '2026-11-01T09:00:00Z' })).status, 400);
  assert.equal((await c('POST', '/events', { title: 'Mal', start_at: '2026-11-02T09:00:00Z', end_at: '2026-11-01T09:00:00Z' })).status, 400);
  const conf = await c('POST', '/events', { title: 'Conferencia de marketing', location: 'Auditorio', start_at: '2026-11-03T09:00:00Z', end_at: '2026-11-03T11:00:00Z', color: '#3A7AA6', reminder_minutes: 1440 });
  assert.equal(conf.status, 201);
  assert.equal(conf.body.color, '#3a7aa6');
  assert.equal(conf.body.all_day, false);
  const congreso = (await c('POST', '/events', { title: 'Congreso', all_day: true, start_at: '2026-11-10T00:00:00Z', end_at: '2026-11-12T22:59:00Z' })).body;
  assert.equal(congreso.all_day, true);
  assert.equal((await c('GET', '/events')).body.length, 2);
  const upd = await c('PUT', `/events/${conf.body.id}`, { title: 'Conferencia de marketing digital' });
  assert.equal(upd.body.title, 'Conferencia de marketing digital');
  assert.equal(upd.body.location, 'Auditorio', 'conserva lo no enviado');
  // Aislamiento
  const otro = client();
  await otro('POST', '/auth/register', { name: 'Otro', email: 'otro-ev@x.com', password: 'secreto123' });
  assert.equal((await otro('GET', '/events')).body.length, 0);
  assert.equal((await otro('PUT', `/events/${conf.body.id}`, { title: 'x' })).status, 404);
  assert.equal((await otro('DELETE', `/events/${conf.body.id}`)).status, 404);
  // Aviso por correo y resumen diario
  const now = new Date('2026-11-02T12:00:00Z');
  sent.length = 0;
  const scheduler = createScheduler({ db, mailer, appUrl: 'http://test', logger: { log() {}, error() {} } });
  await scheduler.tick(now);
  const mail = sent.find((m) => m.to === 'eva-ev@x.com' && m.subject.startsWith('Recordatorio: Conferencia'));
  assert.ok(mail, 'aviso del evento');
  assert.match(mail.text, /Dónde: Auditorio/);
  sent.length = 0;
  await scheduler.tick(now);
  assert.equal(sent.filter((m) => m.subject.startsWith('Recordatorio: Conferencia')).length, 0, 'no se repite');
  await c('PUT', '/me/settings', { daily_digest: true, digest_hour: 7 });
  sent.length = 0;
  await scheduler.tick(now);
  const digest = sent.find((m) => m.to === 'eva-ev@x.com' && m.subject.startsWith('Tu resumen'));
  assert.ok(digest, 'resumen aunque no haya tareas');
  assert.match(digest.subject, /1 evento/);
  assert.match(digest.text, /EVENTOS[\s\S]*Conferencia de marketing digital/);
  assert.equal((await c('DELETE', `/events/${congreso.id}`)).status, 204);
});
