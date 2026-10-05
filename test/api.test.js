import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, dbConfigFromEnv } from '../src/db.js';
import { createApp } from '../src/server.js';
import { createScheduler } from '../src/scheduler.js';

const sent = [];
const mailer = { configured: true, async send(msg) { sent.push(msg); } };
// Por defecto se prueba con SQLite en memoria. Con TEST_DATABASE_URL=mysql://… se prueba contra MySQL.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const { default: mysql } = await import('mysql2/promise');
  const conn = await mysql.createConnection(testUrl);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['checklist_items', 'items', 'schedule_entries', 'subjects', 'time_slots', 'sessions', 'users']) await conn.query(`DROP TABLE IF EXISTS ${t}`);
  await conn.end();
}
const db = await openDb(testUrl ? dbConfigFromEnv({ DATABASE_URL: testUrl }) : { file: ':memory:' });
let server;
let base;

before(async () => {
  server = createApp({ db, mailer, appUrl: 'http://test' }).listen(0);
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
