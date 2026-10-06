'use strict';

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const REMINDERS = [
  [null, 'Sin aviso'], [0, 'A la hora exacta'], [15, '15 minutos antes'], [30, '30 minutos antes'],
  [60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes'], [720, '12 horas antes'], [1440, '1 día antes'],
  [2880, '2 días antes'], [4320, '3 días antes'], [10080, '1 semana antes'],
];
const PALETTE = ['#c8553d', '#e07b3c', '#e0a43a', '#b5a032', '#6f9a48', '#3f8c66', '#2e8a8a', '#3a7aa6', '#4f68b0', '#7461a6', '#a1568f', '#c45a74', '#7c8a8f', '#8a6a4c'];

/* Iconos de línea (24×24) */
const ICONS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.4 2.8 2.8L16.3 9.5"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5v-15Z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5"/><path d="M9 7.5h6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  sent: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m8.5 12 2.5 2.5 4.5-4.5"/>',
  pencil: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z"/><path d="m14.5 7.5 3 3"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  cup: '<path d="M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5V6M12 3.5V6"/>',
  alert: '<path d="M10.3 4.6 3 17.5A2 2 0 0 0 4.7 20.5h14.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4M12 17h.01"/>',
  logout: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M9.5 16 5.5 12l4-4M5.5 12H15"/>',
  exam: '<path d="M7 3h7.5L19 7.5V21H7Z"/><path d="M14 3v5h5M10 12.5h5.5M10 16.5h5.5"/>',
  down: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  event: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m12 12.2 1.05 2.15 2.35.33-1.7 1.66.4 2.35-2.1-1.1-2.1 1.1.4-2.35-1.7-1.66 2.35-.33Z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  select: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="m13.5 17 2.3 2.3 4.2-4.6"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.6 1.7-1.6h2.1a4 4 0 0 0 4-4C20.5 6.6 16.7 3.5 12 3.5Z"/><circle cx="7.8" cy="11.2" r="1.1"/><circle cx="10" cy="7.6" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/>',
};
const icon = (name, cls = '') =>
  `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M10.5 9.5v13M21.5 9.5v13M10.5 16h11" fill="none" stroke="var(--logo-ink, #fff)" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="7.5" r="3.2" fill="var(--warm)"/></svg>`;
const brand = () => `<div class="brand">${LOGO}<span class="wordmark">Horaria</span></div>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const fmtLongDate = (d) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDateTime = (d) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + timeOf(d);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function relative(d) {
  const diff = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round((parseKey(dateKey(d)) - parseKey(dateKey(new Date()))) / 86400000);
  return rtf.format(days, 'day');
}

/** Color de texto legible (blanco o negro) sobre un fondo dado. */
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}
function shortName(s) {
  if (s.short_name) return s.short_name;
  const words = s.name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w));
  return words.length > 1 ? words.slice(0, 3).map((w) => w[0].toUpperCase()).join('') : s.name.slice(0, 4);
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' err' : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), isError ? 5000 : 2500);
}

async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    credentials: 'same-origin',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && state.user) { state.user = null; closeModal(); renderAuth('login'); }
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data;
}
/** Ejecuta una acción mostrando el error en un aviso si falla. */
async function attempt(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message, true);
    return undefined;
  }
}

const mobileQuery = window.matchMedia('(max-width: 760px)');
const isMobile = () => mobileQuery.matches;
mobileQuery.addEventListener('change', () => renderView());

function pref(key, fallback) {
  try { const v = localStorage.getItem('horario.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function setPref(key, value) {
  try { localStorage.setItem('horario.' + key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
}

/*
 * Altura real de la pantalla. Algunos navegadores (los integrados en Instagram o WhatsApp,
 * o versiones antiguas de Safari y Chrome) no entienden «100dvh» y hacían la app más alta que la
 * pantalla: al desplazar una lista larga, como Tareas, se movía toda la página y se cortaba la parte
 * de arriba. Se mide con JavaScript y se recalcula al girar el móvil o cambiar el tamaño.
 */
function syncAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 250));
window.addEventListener('pageshow', syncAppHeight);

/* ============================================================
   Estado
   ============================================================ */
const state = {
  user: null,
  mailConfigured: false,
  subjects: [],
  slots: [],
  schedule: [],
  items: [],
  events: [],
  view: 'month',
  cursor: startOfMonth(new Date()),
  selectedDay: dateKey(new Date()),
  showClasses: pref('showClasses', true),
  filter: { type: 'all', subject: '', showDone: pref('showDone', false) },
};
const subjectById = (id) => state.subjects.find((s) => s.id === id);
/** Asignaturas principales de un horario (cada horario tiene las suyas). */
const ttSubjects = (ttId) => state.subjects.filter((s) => s.timetable_id === ttId && !s.parent_id);
/* Subasignaturas: un nivel por debajo de una asignatura; heredan aula y profesor si los dejan vacíos. */
const subsOf = (id) => state.subjects.filter((s) => s.parent_id === id);
const parentOf = (s) => (s?.parent_id ? subjectById(s.parent_id) : null);
const topOf = (s) => parentOf(s) || s;
const subjectLabel = (s) => (!s ? '' : parentOf(s) ? `${parentOf(s).name} · ${s.name}` : s.name);
const effRoom = (s) => s?.room || parentOf(s)?.room || '';
const effTeacher = (s) => s?.teacher || parentOf(s)?.teacher || '';
const itemById = (id) => state.items.find((i) => i.id === id);
/** Días que muestra un horario (cada horario tiene los suyos). */
const ttDays = (tt) => tt?.visible_days || state.user.visible_days || [1, 2, 3, 4, 5];
const visibleDays = (tt = activeTT()) => DAY_ORDER.filter((d) => ttDays(tt).includes(d));
/** El mes muestra siempre la semana completa; los días de cada horario solo afectan a sus clases. */
const monthDays = () => DAY_ORDER;
/* Varios horarios: cada uno tiene sus tramos y clases. */
const activeTT = () => state.timetables.find((t) => t.id === state.user.active_timetable_id) || state.timetables[0];
const ttSlots = (ttId) => state.slots.filter((s) => s.timetable_id === ttId);
/** Las fechas de un horario (opcionales) limitan los días en que tiene clases. */
function ttCovers(tt, d) {
  const k = typeof d === 'string' ? d : dateKey(d);
  return (!tt.start_date || k >= tt.start_date) && (!tt.end_date || k <= tt.end_date);
}
/** Clases de un horario en una fecha concreta (según sus días y sus fechas). */
const classesOnDate = (tt, d) => (ttCovers(tt, d) && ttDays(tt).includes(d.getDay()) ? classesOn(d.getDay(), tt.id) : []);
/* Cada horario es independiente: sus tareas, exámenes y eventos solo se ven en él. */
const ttItems = (ttId = activeTT().id) => state.items.filter((i) => i.timetable_id === ttId);
const ttEvents = (ttId = activeTT().id) => state.events.filter((e) => e.timetable_id === ttId);
function applyTimetables(payload) {
  if (payload.user) state.user = payload.user;
  if (payload.timetables) state.timetables = payload.timetables;
  if (payload.slots) state.slots = payload.slots;
  if (payload.subjects) state.subjects = payload.subjects;
  if (payload.schedule) state.schedule = payload.schedule;
}
async function setActiveTimetable(id) {
  const r = await attempt(() => api('PUT', '/me/settings', { active_timetable_id: id }));
  if (r) state.user = r.user;
  renderView();
}

function classesOn(day, ttId = activeTT().id) {
  const slots = ttSlots(ttId);
  const slotIndex = new Map(slots.map((s, i) => [s.id, i]));
  return state.schedule
    .filter((e) => e.day === day && slotIndex.has(e.slot_id) && subjectById(e.subject_id))
    .sort((a, b) => slotIndex.get(a.slot_id) - slotIndex.get(b.slot_id))
    .map((e) => ({ entry: e, slot: slots[slotIndex.get(e.slot_id)], subject: subjectById(e.subject_id) }));
}

async function loadAll() {
  const [boot, items, events] = await Promise.all([api('GET', '/bootstrap'), api('GET', '/items'), api('GET', '/events')]);
  state.events = events;
  state.user = boot.user;
  state.mailConfigured = boot.mail_configured;
  state.pushAvailable = boot.push_available;
  state.pushDevices = boot.push_devices;
  state.subjects = boot.subjects;
  state.slots = boot.slots;
  state.timetables = boot.timetables;
  state.schedule = boot.schedule;
  state.items = items;
}
const eventById = (id) => state.events.find((e) => e.id === id);
/** Días (claves AAAA-MM-DD) que ocupa un evento; los de varios días aparecen en cada uno. */
function eventDayKeys(ev) {
  const keys = [];
  const start = parseKey(dateKey(new Date(ev.start_at)));
  const end = ev.end_at ? parseKey(dateKey(new Date(ev.end_at))) : start;
  for (let d = new Date(start); d <= end && keys.length < 62; d.setDate(d.getDate() + 1)) keys.push(dateKey(d));
  return keys;
}
function eventTimeLabel(ev) {
  if (ev.all_day) return 'Todo el día';
  const s = timeOf(new Date(ev.start_at));
  if (!ev.end_at) return s;
  const e = new Date(ev.end_at);
  return dateKey(e) === dateKey(new Date(ev.start_at)) ? `${s}–${timeOf(e)}` : `${s} → ${e.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${timeOf(e)}`;
}
function upsertEvent(ev) {
  const i = state.events.findIndex((x) => x.id === ev.id);
  if (i >= 0) state.events[i] = ev; else state.events.push(ev);
  state.events.sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id);
}
function upsertItem(item) {
  const i = state.items.findIndex((x) => x.id === item.id);
  if (i >= 0) state.items[i] = item; else state.items.push(item);
  state.items.sort((a, b) => a.due_at.localeCompare(b.due_at) || a.id - b.id);
}
function refresh() {
  renderView();
  modalRefresh?.();
}

/* ============================================================
   Inicio de sesión / registro
   ============================================================ */
function renderAuth(mode) {
  const isLogin = mode === 'login';
  $('#app').innerHTML = `
    <div class="auth-wrap">
    <aside class="auth-brand">
      ${brand()}
      <h1>El curso entero, en una sola vista.</h1>
      <ul>
        <li>${icon('grid')}<span>Tu horario semanal con aulas, profesorado y un color para cada asignatura.</span></li>
        <li>${icon('check')}<span>Tareas y exámenes con su lista de pasos para ir tachando.</span></li>
        <li>${icon('mail')}<span>Un recordatorio en tu correo antes de cada entrega.</span></li>
      </ul>
    </aside>
    <div class="auth-side">
    <form class="auth" id="auth-form" novalidate>
      ${brand()}
      <h2>${isLogin ? 'Hola de nuevo' : 'Crea tu cuenta'}</h2>
      <p class="sub">${isLogin ? 'Entra para ver tu semana.' : 'Solo necesitas un correo y una contraseña.'}</p>
      ${isLogin ? '' : '<label class="field"><span>Nombre</span><input type="text" name="name" autocomplete="name" required></label>'}
      <label class="field"><span>Correo electrónico</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8">
        ${isLogin ? '' : '<small class="hint">Mínimo 8 caracteres.</small>'}</label>
      <div class="error" id="auth-error"></div>
      <button class="btn btn-primary" type="submit">${isLogin ? 'Entrar' : 'Crear cuenta'}</button>
      <div class="switch">${isLogin ? '¿Aún no tienes cuenta? <a data-mode="register">Regístrate</a>' : '¿Ya tienes cuenta? <a data-mode="login">Inicia sesión</a>'}</div>
    </form>
    </div>
    </div>`;
  $('.switch a').onclick = (e) => renderAuth(e.target.dataset.mode);
  if (!window.matchMedia('(pointer: coarse)').matches) $('#auth-form input').focus();
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    try {
      if (isLogin) await api('POST', '/auth/login', fd);
      else await api('POST', '/auth/register', { ...fd, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      await start();
    } catch (err) {
      $('#auth-error').textContent = err.message;
      btn.disabled = false;
    }
  };
}

/* ============================================================
   Estructura principal
   ============================================================ */
/* Pestañas visibles; Asignaturas y Ajustes están en el menú de la cuenta (arriba a la derecha). */
const TAB_VIEWS = ['month', 'week', 'items'];
const VIEWS = [
  ['month', 'calendar', 'Mes', 'Mes'],
  ['week', 'grid', 'Horario', 'Horario'],
  ['items', 'check', 'Tareas y exámenes', 'Tareas'],
  ['subjects', 'book', 'Asignaturas', 'Materias'],
  ['settings', 'sliders', 'Ajustes', 'Ajustes'],
];

function renderShell() {
  $('#app').innerHTML = `
    <header class="topbar">
      ${brand()}
      <nav class="tabs">${VIEWS.filter((v) => TAB_VIEWS.includes(v[0])).map(([id, ic, label, short]) => `<button data-view="${id}">${icon(ic)}<span class="long">${label}</span><span class="short">${short}</span></button>`).join('')}</nav>
      <div class="userbox">
        <button class="user-btn" id="user-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="user-menu" title="Tu cuenta">
          <span class="avatar" aria-hidden="true">${esc(initials(state.user.name))}</span><span class="name">${esc(state.user.name)}</span>${icon('down')}
        </button>
        <div class="user-menu" id="user-menu" role="menu" hidden>
          <div class="um-head"><b class="um-name">${esc(state.user.name)}</b><small>${esc(state.user.email)}</small></div>
          <button role="menuitem" data-view="subjects">${icon('book')}Asignaturas</button>
          <button role="menuitem" data-view="settings">${icon('sliders')}Ajustes</button>
          <hr>
          <button role="menuitem" id="logout" class="danger">${icon('logout')}Cerrar sesión</button>
        </div>
      </div>
    </header>
    <main id="view"></main>`;
  $('.tabs').onclick = (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) location.hash = b.dataset.view;
  };
  const menu = $('#user-menu');
  const menuBtn = $('#user-menu-btn');
  const setMenu = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn.onclick = (e) => { e.stopPropagation(); setMenu(menu.hidden); };
  menu.onclick = (e) => {
    const b = e.target.closest('[data-view]');
    if (b) { location.hash = b.dataset.view; setMenu(false); }
  };
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.userbox')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  $('#logout').onclick = async () => {
    await forgetThisDevice();
    await api('POST', '/auth/logout').catch(() => {});
    state.user = null;
    renderAuth('login');
  };
  bindViewEvents($('#view'));
}

function renderView() {
  if (!state.user || !$('#view')) return;
  const view = VIEWS.some(([id]) => id === location.hash.slice(1)) ? location.hash.slice(1) : 'month';
  state.view = view;
  if (view !== 'week') state.ttSel = null;
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('#user-menu [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#user-menu-btn')?.classList.toggle('active', !TAB_VIEWS.includes(view));
  const el = $('#view');
  const scrollEl = $('.scroll', el);
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
  el.innerHTML = { month: monthView, week: weekView, items: itemsView, subjects: subjectsView, settings: settingsView }[view]();
  if (view === 'settings') bindSettings(el);
  if (view === 'week') { fitTimetable(el); updateSelectBar(); }
  const newScroll = $('.scroll', el);
  if (newScroll && el.dataset.lastView === view) newScroll.scrollTop = scrollTop;
  el.dataset.lastView = view;
}
window.addEventListener('hashchange', renderView);

/** Eventos comunes (delegados) para listas de tareas en vistas y modales. */
function bindViewEvents(root) {
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.toggle) {
      const item = await attempt(() => api('PUT', `/items/${t.dataset.toggle}`, { done: t.checked }));
      if (item) { upsertItem(item); refresh(); if (item.done) toast('Marcada como hecha'); } else t.checked = !t.checked;
    } else if (t.dataset.check) {
      const item = await attempt(() => api('PATCH', `/checklist/${t.dataset.check}`, { done: t.checked }));
      if (item) {
        upsertItem(item);
        refresh();
        if (!item.done && item.checklist.length && item.checklist.every((c) => c.done)) toast('Lista completa. Ya puedes marcarla como hecha.');
      } else t.checked = !t.checked;
    }
  });
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('input[type=checkbox]') || t.closest('label')) return;
    const act = t.closest('[data-action]');
    const returnTo = t.closest('#modal-root') ? openDayKey : null;
    if (act) { e.stopPropagation(); return ACTIONS[act.dataset.action]?.(act.dataset, returnTo); }
    const edit = t.closest('[data-edit]');
    if (edit) { e.stopPropagation(); return openItemModal(itemById(Number(edit.dataset.edit)), { returnTo }); }
    const evEl = t.closest('[data-event]');
    if (evEl) { e.stopPropagation(); return openEventModal(eventById(Number(evEl.dataset.event)), { returnTo }); }
    const cell = t.closest('.day-cell');
    if (cell) return isMobile() ? selectDay(cell.dataset.date) : openDayModal(cell.dataset.date);
    const tt = t.closest('.tt-cell');
    if (tt) {
      // Ctrl/⌘/Mayús + clic también empieza a seleccionar varias casillas.
      if (!state.ttSel && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        state.ttSel = { ttId: activeTT().id, keys: new Set() };
        renderView();
      }
      if (state.ttSel) return toggleCells([cellKey(tt)]);
      return openSlotModal([{ day: Number(tt.dataset.day), slotIds: tt.dataset.slots.split(',').map(Number) }]);
    }
    // Seleccionando: el día de la cabecera elige toda la columna y la hora, toda la fila.
    const head = state.ttSel && t.closest('.tt-head[data-day], .tt-time[data-slot]');
    if (head) {
      const sel = head.dataset.day ? `.tt-cell[data-day="${head.dataset.day}"]` : '.tt-cell';
      toggleCells($$(sel, $('#view')).filter((c) => !head.dataset.slot || c.dataset.slots.split(',').includes(head.dataset.slot)).map(cellKey));
    }
  });
}

/* Selección de varias casillas del horario (para ponerles la misma asignatura a la vez). */
const cellKey = (el) => `${el.dataset.day}:${el.dataset.slots}`;
const parseCellKey = (k) => { const [day, ids] = k.split(':'); return { day: Number(day), slotIds: ids.split(',').map(Number) }; };
function toggleCells(keys) {
  const sel = state.ttSel.keys;
  const add = keys.some((k) => !sel.has(k));
  for (const k of keys) add ? sel.add(k) : sel.delete(k);
  for (const el of $$('.tt-cell', $('#view'))) el.classList.toggle('sel', sel.has(cellKey(el)));
  updateSelectBar();
}
function updateSelectBar() {
  const n = state.ttSel?.keys.size || 0;
  const label = $('#sel-count');
  if (!label) return;
  label.textContent = n ? `${n} ${n === 1 ? 'casilla seleccionada' : 'casillas seleccionadas'}` : 'Toca casillas, un día o una hora';
  $('#sel-assign').disabled = !n;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.ttSel && !$('#modal-root').innerHTML) { state.ttSel = null; renderView(); }
});

function selectDay(key) {
  state.selectedDay = key;
  const d = parseKey(key);
  if (d.getMonth() !== state.cursor.getMonth() || d.getFullYear() !== state.cursor.getFullYear()) state.cursor = startOfMonth(d);
  renderView();
}
function goMonth(delta) {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + delta, 1);
  const today = new Date();
  state.selectedDay = dateKey(today.getMonth() === state.cursor.getMonth() && today.getFullYear() === state.cursor.getFullYear() ? today : state.cursor);
  renderView();
}

const ACTIONS = {
  prev: () => goMonth(-1),
  next: () => goMonth(1),
  today: () => { state.cursor = startOfMonth(new Date()); state.selectedDay = dateKey(new Date()); renderView(); },
  newItem: (d, returnTo) => openItemModal(null, { type: d.type, date: d.date, returnTo }),
  newSubject: () => openSubjectModal(null),
  newEvent: (d, returnTo) => openEventModal(null, { date: d.date, returnTo }),
  newSub: (d) => openSubjectModal(null, subjectById(Number(d.parent))),
  editSubject: (d) => openSubjectModal(subjectById(Number(d.id))),
  deleteSubject: async (d) => {
    deleteSubjectFlow(subjectById(Number(d.id)));
  },
  goto: (d) => { location.hash = d.view; },
  pickBackground: () => openBackgroundModal(),
  editTimetable: () => openTimetableModal(activeTT()),
  downloadTimetable: () => openDownloadModal(),
  toggleSelect: () => { state.ttSel = state.ttSel ? null : { ttId: activeTT().id, keys: new Set() }; renderView(); },
  cancelSelect: () => { state.ttSel = null; renderView(); },
  assignSelected: () => {
    const cells = [...(state.ttSel?.keys || [])].map(parseCellKey);
    if (cells.length) openSlotModal(cells);
  },
};

/* ============================================================
   Vista mensual
   ============================================================ */
function eventChip(ev, key) {
  const startKey = dateKey(new Date(ev.start_at));
  const time = ev.all_day || key !== startKey ? '' : `<time>${timeOf(new Date(ev.start_at))}</time>`;
  return `<div class="ev-chip" data-event="${ev.id}" style="--c:${ev.color}" title="${esc(`Evento: ${ev.title} · ${eventTimeLabel(ev)}${ev.location ? ` · ${ev.location}` : ''}`)}">
    <span class="t">${time}${esc(ev.title)}</span></div>`;
}

function itemChip(item) {
  const d = new Date(item.due_at);
  const s = subjectById(item.subject_id);
  const doneCount = item.checklist.filter((c) => c.done).length;
  return `<div class="chip-item ${item.type} ${item.done ? 'done' : ''}" data-edit="${item.id}" style="--c:${s ? s.color : 'var(--muted)'}"
      title="${esc(`${item.type === 'exam' ? 'Examen' : 'Tarea'}: ${item.title}${s ? ` (${s.name})` : ''} · ${timeOf(d)}`)}">
    <input type="checkbox" data-toggle="${item.id}" ${item.done ? 'checked' : ''} aria-label="Marcar como hecha">
    <span class="t"><time>${timeOf(d)}</time>${esc(item.title)}</span>
    ${item.checklist.length ? `<span class="prog">${doneCount}/${item.checklist.length}</span>` : ''}
  </div>`;
}

/** Junta las clases seguidas de la misma asignatura (p. ej. dos horas de Matemáticas). */
function groupClasses(classes) {
  const groups = [];
  for (const c of classes) {
    const last = groups[groups.length - 1];
    if (last && last.subject.id === c.subject.id) { last.count += 1; last.end = c.slot.end_time; }
    else groups.push({ subject: c.subject, count: 1, start: c.slot.start_time, end: c.slot.end_time });
  }
  return groups;
}

function monthView() {
  const tt = activeTT();
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const days = monthDays();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const weeks = [];
  for (let d = new Date(y, m, 1 - ((first.getDay() + 6) % 7)); d <= last; ) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const vis = week.filter((x) => days.includes(x.getDay()));
    if (vis.some((x) => x.getMonth() === m)) weeks.push(vis);
  }
  const items = ttItems(tt.id);
  const byDay = new Map();
  for (const it of items) {
    const k = dateKey(new Date(it.due_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(it);
  }
  const eventsByDay = new Map();
  for (const ev of ttEvents(tt.id)) {
    for (const k of eventDayKeys(ev)) {
      if (!eventsByDay.has(k)) eventsByDay.set(k, []);
      eventsByDay.get(k).push(ev);
    }
  }
  const todayKey = dateKey(new Date());
  const classCache = new Map();
  const classesFor = (d) => {
    if (!ttCovers(tt, d)) return [];
    if (!classCache.has(d.getDay())) classCache.set(d.getDay(), classesOnDate(tt, d));
    return classCache.get(d.getDay());
  };
  const title = cap(state.cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
  const monthPrefix = `${y}-${pad(m + 1)}`;
  const monthItems = items.filter((i) => dateKey(new Date(i.due_at)).startsWith(monthPrefix));
  const pendingExams = monthItems.filter((i) => i.type === 'exam' && !i.done).length;
  const pendingTasks = monthItems.filter((i) => i.type === 'task' && !i.done).length;

  const mobile = isMobile();
  if (mobile && !weeks.flat().some((d) => dateKey(d) === state.selectedDay)) {
    const firstVisible = weeks.flat().find((d) => d.getMonth() === m);
    if (firstVisible) state.selectedDay = dateKey(firstVisible);
  }
  const cells = weeks.flat().map((d) => {
    const k = dateKey(d);
    if (mobile) {
      const dayItems = byDay.get(k) || [];
      const dayEvents = eventsByDay.get(k) || [];
      const groups = state.showClasses ? groupClasses(classesFor(d)) : [];
      return `<div class="day-cell ${d.getMonth() !== m ? 'other' : ''} ${k === todayKey ? 'today' : ''} ${k === state.selectedDay ? 'selected' : ''}" data-date="${k}">
        <span class="day-num">${d.getDate()}</span>
        ${groups.length ? `<div class="cbar">${groups.map((g) => `<i style="background:${g.subject.color};flex:${g.count}"></i>`).join('')}</div>` : ''}
        <div class="dots">${dayEvents.slice(0, 2).map((ev) => `<i class="ev" style="--c:${ev.color}"></i>`).join('')}${dayItems.slice(0, 4).map((i) => `<i class="${i.type} ${i.done ? 'done' : ''}" style="--c:${subjectById(i.subject_id)?.color || 'var(--muted)'}"></i>`).join('')}${dayItems.length > 4 ? `<b>+${dayItems.length - 4}</b>` : ''}</div>
      </div>`;
    }
    const classes = state.showClasses ? classesFor(d) : [];
    return `<div class="day-cell ${d.getMonth() !== m ? 'other' : ''} ${k === todayKey ? 'today' : ''}" data-date="${k}">
      <div class="day-head"><span class="day-num">${d.getDate()}</span><button class="icon-btn add" data-action="newItem" data-type="task" data-date="${k}" title="Añadir tarea" aria-label="Añadir tarea">${icon('plus')}</button></div>
      ${classes.length ? `<div class="classes">${groupClasses(classes).map((g) => `<span class="cls" style="--c:${g.subject.color}" title="${esc(`${g.start}–${g.end} ${subjectLabel(g.subject)}`)}">${esc(shortName(g.subject))}${g.count > 1 ? `×${g.count}` : ''}</span>`).join('')}</div>` : ''}
      <div class="cell-items">${(eventsByDay.get(k) || []).map((ev) => eventChip(ev, k)).join('')}${(byDay.get(k) || []).map(itemChip).join('')}</div>
    </div>`;
  });

  return `
    <div class="toolbar tt-toolbar">${ttSwitcher()}</div>
    <div class="toolbar month-toolbar">
      <button class="btn" data-action="prev" title="Mes anterior" aria-label="Mes anterior">${icon('left')}</button>
      <h2>${esc(title)}</h2>
      <button class="btn" data-action="next" title="Mes siguiente" aria-label="Mes siguiente">${icon('right')}</button>
      <button class="btn" data-action="today">Hoy</button>
      <span class="legend hide-mobile"><span><i class="legend-dot exam"></i>${plural(pendingExams, 'examen', 'exámenes')}</span><span><i class="legend-dot"></i>${plural(pendingTasks, 'tarea pendiente', 'tareas pendientes')}</span></span>
      <span class="spacer"></span>
      <label class="toggle hide-mobile"><input type="checkbox" id="toggle-classes" ${state.showClasses ? 'checked' : ''}> Clases</label>
      <button class="btn btn-primary hide-mobile" data-action="newItem" data-type="task">${icon('plus')}Tarea</button>
      <button class="btn btn-exam hide-mobile" data-action="newItem" data-type="exam">${icon('plus')}Examen</button>
      <button class="btn btn-event hide-mobile" data-action="newEvent">${icon('plus')}Evento</button>
    </div>
    ${mobile ? '<div class="scroll month-scroll">' : ''}
    <div class="month-grid ${mobile ? 'compact' : ''}" style="grid-template-columns:repeat(${days.length},minmax(0,1fr));grid-template-rows:auto repeat(${weeks.length},minmax(0,1fr))${mobile ? '' : `;min-height:${34 + weeks.length * 76}px`}">
      ${days.map((d) => `<div class="dow">${DAY_SHORT[d]}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${mobile ? `<section class="agenda">${dayDetail(state.selectedDay, false)}</section></div>` : ''}`;
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'toggle-classes') {
    state.showClasses = e.target.checked;
    setPref('showClasses', state.showClasses);
    renderView();
  }
});

/* ============================================================
   Horario semanal
   ============================================================ */
const TT_BACKGROUNDS = [
  ['rayas', 'Rayas'], ['rayas-rosa', 'Rayas rosa'], ['cuadricula', 'Cuadrícula'], ['puntos', 'Puntos'], ['lisa', 'Blanco'],
  ['arena', 'Arena'], ['menta', 'Menta'], ['lavanda', 'Lavanda'], ['cielo', 'Cielo'], ['noche', 'Noche'],
];

/** Clases de un día agrupadas: las horas seguidas de la misma asignatura y aula forman un solo bloque. */
function dayBlocks(day, slots = ttSlots(activeTT().id)) {
  const blocks = [];
  for (let i = 0; i < slots.length; ) {
    if (slots[i].is_break) { i++; continue; }
    const at = (k) => {
      const entry = state.schedule.find((e) => e.slot_id === slots[k].id && e.day === day);
      const subject = entry && subjectById(entry.subject_id);
      return subject ? { entry, subject, room: entry.room_override || effRoom(subject) } : null;
    };
    const first = at(i);
    let k = i + 1;
    if (first) {
      while (k < slots.length && !slots[k].is_break) {
        const next = at(k);
        if (!next || next.subject.id !== first.subject.id || next.room !== first.room) break;
        k++;
      }
    }
    blocks.push({ row: i, span: k - i, slots: slots.slice(i, k), ...(first || {}) });
    i = k;
  }
  return blocks;
}

/** Título con el nombre del horario abierto; al pulsarlo se cambia de horario o se crea uno. */
function ttSwitcher() {
  const tt = activeTT();
  return `<label class="tt-switch" title="Cambiar de horario">
        <select id="tt-select" aria-label="Horario">
          ${state.timetables.map((t) => `<option value="${t.id}" ${t.id === tt.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          <option value="__new">+ Nuevo horario…</option>
        </select>${icon('down')}
      </label>
      <button class="icon-btn" data-action="editTimetable" title="Editar este horario" aria-label="Editar este horario">${icon('pencil')}</button>`;
}

function weekView() {
  const tt = activeTT();
  const days = visibleDays(tt);
  const slots = ttSlots(tt.id);
  if (state.ttSel && state.ttSel.ttId !== tt.id) state.ttSel = null;
  const sel = state.ttSel;
  const toolbar = `
    <div class="toolbar tt-toolbar">
      ${ttSwitcher()}
      <span class="spacer"></span>
      ${slots.length ? `<button class="btn ${sel ? 'active' : ''}" data-action="toggleSelect" title="Seleccionar varias casillas" aria-pressed="${Boolean(sel)}">${icon('select')}<span class="long">Seleccionar</span><span class="short">Varias</span></button>` : ''}
      <button class="btn" data-action="downloadTimetable" title="Descargar como imagen">${icon('download')}<span class="long">Descargar</span></button>
      <button class="btn" data-action="pickBackground" title="Fondo del horario">${icon('palette')}<span class="long">Fondo</span></button>
      <button class="btn" data-action="goto" data-view="settings" title="Tramos y días">${icon('sliders')}<span class="long">Tramos</span></button>
      <button class="btn" data-action="goto" data-view="subjects" title="Asignaturas">${icon('book')}<span class="long">Asignaturas</span></button>
    </div>`;
  if (!slots.length) {
    return `${toolbar}<div class="empty card"><strong>Este horario aún no tiene tramos</strong><p>Define primero las horas de clase.</p><button class="btn btn-primary" data-action="goto" data-view="settings">Configurar tramos</button></div>`;
  }
  const now = new Date();
  const nowTime = timeOf(now);
  const todayDow = now.getDay();
  let cells = '<div class="tt-corner" style="grid-area:1 / 1"></div>';
  days.forEach((d, j) => {
    cells += `<div class="tt-head ${d === todayDow ? 'today' : ''}" data-day="${d}" style="grid-area:1 / ${j + 2}"><span class="long">${DAY_LONG[d]}</span><span class="short">${DAY_SHORT[d]}</span></div>`;
  });
  let number = 0;
  slots.forEach((slot, i) => {
    const row = i + 2;
    const range = `${slot.start_time}–${slot.end_time}`;
    if (slot.is_break) {
      cells += `<div class="tt-time brk" style="grid-area:${row} / 1" title="${range}">${icon('cup')}</div>`;
      days.forEach((d, j) => { cells += `<div class="tt-break" style="grid-area:${row} / ${j + 2}">${esc(slot.label || 'Descanso')}</div>`; });
      return;
    }
    number += 1;
    // El número sale de la etiqueta del tramo («2», «2ª hora»…); si no tiene, se numera en orden.
    const shown = slot.label.match(/\d+/)?.[0] ?? number;
    cells += `<div class="tt-time" data-slot="${slot.id}" style="grid-area:${row} / 1" title="${esc(range + (slot.label ? ` · ${slot.label}` : ''))}"><span class="t">${slot.start_time}</span><b>${shown}</b></div>`;
  });
  days.forEach((d, j) => {
    for (const b of dayBlocks(d, slots)) {
      const startT = b.slots[0].start_time;
      const endT = b.slots[b.slots.length - 1].end_time;
      const isNow = d === todayDow && nowTime >= startT && nowTime < endT;
      const area = `grid-area:${b.row + 2} / ${j + 2} / span ${b.span} / span 1`;
      const ids = b.slots.map((x) => x.id).join(',');
      const selCls = sel?.keys.has(`${d}:${ids}`) ? 'sel' : '';
      if (b.subject) {
        const s = b.subject;
        const tip = [subjectLabel(s), `${startT}–${endT}`, b.room && `Aula ${b.room}`, effTeacher(s)].filter(Boolean).join(' · ');
        cells += `<div class="tt-cell filled ${isNow ? 'now' : ''} ${selCls}" data-slots="${ids}" data-day="${d}" style="${area};--c:${s.color};--ink:${textOn(s.color)}" title="${esc(tip)}">
          <div class="tt-name"><span>${esc(s.name)}</span></div>
          ${b.room ? `<div class="tt-room">${esc(b.room)}</div>` : ''}
        </div>`;
      } else {
        cells += `<div class="tt-cell ${isNow ? 'now' : ''} ${selCls}" data-slots="${ids}" data-day="${d}" style="${area}" title="${esc(`${DAY_LONG[d]} ${startT}–${endT}`)}"><span class="plus">${icon('plus')}</span></div>`;
      }
    }
  });
  const rows = slots.map((x) => (x.is_break ? 'minmax(0,.6fr)' : 'minmax(0,1fr)')).join(' ');
  return `${toolbar}
    <div class="tt-board bg-${tt.background || 'rayas'} ${sel ? 'selecting' : ''}" style="min-height:${ttMinHeight(slots)}px">
      <div class="tt-grid" style="grid-template-columns:${isMobile() ? '38px' : '68px'} repeat(${days.length},minmax(0,1fr));grid-template-rows:auto ${rows}">${cells}</div>
    </div>
    ${sel ? `<div class="select-bar" role="status">
      <span id="sel-count"></span>
      <button class="btn" data-action="cancelSelect">Cancelar</button>
      <button class="btn btn-primary" id="sel-assign" data-action="assignSelected">Asignar</button>
    </div>` : ''}`;
}

/** Altura mínima legible del horario: por debajo, la página se desplaza en lugar de aplastar las clases. */
function ttMinHeight(slots) {
  const row = isMobile() ? 50 : 56;
  return 46 + slots.reduce((h, s) => h + (s.is_break ? 30 : row), 0) + (isMobile() ? 10 : 28);
}

/** Ajusta el tamaño de letra de cada clase para que el nombre completo quepa en su casilla. */
function fitTimetable(root = $('#view')) {
  for (const box of $$('.tt-name', root)) {
    const span = box.firstElementChild;
    box.classList.remove('break-any');
    box.style.fontSize = '';
    let size = parseFloat(getComputedStyle(box).fontSize);
    const overflows = () => span.offsetHeight > box.clientHeight + 1 || span.scrollWidth > span.clientWidth + 1;
    const shrinkTo = (min) => {
      while (size > min && overflows()) {
        size -= 0.5;
        box.style.fontSize = `${size}px`;
      }
    };
    // Primero se reduce la letra hasta un tamaño cómodo; si aún no cabe, se parten las palabras largas.
    shrinkTo(isMobile() ? 10.5 : 11);
    if (overflows()) {
      box.classList.add('break-any');
      shrinkTo(8);
    }
  }
}
let fitTimer;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => { if (state.view === 'week') fitTimetable(); }, 120);
});

function openBackgroundModal() {
  const tt = activeTT();
  const current = tt.background || 'rayas';
  openModal(`
    <div class="modal-head"><h2>Fondo del horario</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
    <div class="bg-options">
      ${TT_BACKGROUNDS.map(([key, label]) => `<button type="button" class="bg-option ${key === current ? 'active' : ''}" data-bg="${key}"><span class="bg-swatch bg-${key}"></span><span>${label}</span></button>`).join('')}
    </div>`, (root) => {
    $('.bg-options', root).onclick = async (e) => {
      const b = e.target.closest('[data-bg]');
      if (!b) return;
      const r = await attempt(() => api('PUT', `/timetables/${tt.id}`, { background: b.dataset.bg }));
      if (r) {
        state.timetables = r;
        closeModal();
        renderView();
      }
    };
  });
}

/** Crear un horario nuevo (tt = null) o editar uno existente. */
function openTimetableModal(tt) {
  const isNew = !tt;
  const current = activeTT();
  openModal(`
    <form id="tt-form" novalidate>
      <div class="modal-head"><h2>${isNew ? 'Nuevo horario' : 'Editar horario'}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <label class="field"><span>Nombre</span><input type="text" name="name" required value="${esc(tt?.name || '')}" placeholder="Ej.: 3º Publicidad y RRPP (2º cuatrimestre)"></label>
      <div class="row">
        <label class="field"><span>Desde (opcional)</span><input type="date" name="start_date" value="${tt?.start_date || ''}"></label>
        <label class="field"><span>Hasta (opcional)</span><input type="date" name="end_date" value="${tt?.end_date || ''}"></label>
      </div>
      <p class="hint" style="margin:-6px 0 14px">Si pones fechas, sus clases solo aparecen en el calendario entre esas fechas.</p>
      <div class="field"><span>Días de la semana</span>
        <div class="days-pick compact" id="tt-days">${DAY_ORDER.map((d) => {
          const on = ttDays(tt || current).includes(d);
          return `<label class="${on ? 'on' : ''}"><input type="checkbox" value="${d}" ${on ? 'checked' : ''}> ${DAY_SHORT[d]}</label>`;
        }).join('')}</div>
      </div>
      ${isNew ? `<label class="field"><span>Empezar con</span><select name="copy_from">
          ${state.timetables.map((t) => `<option value="${t.id}" ${t.id === current.id ? 'selected' : ''}>Una copia de «${esc(t.name)}» (tramos, asignaturas y clases)</option>`).join('')}
          <option value="">Un horario vacío (sin asignaturas, con los tramos por defecto)</option>
        </select></label>` : ''}
      <div class="error" id="form-error"></div>
      <div class="modal-foot">
        ${!isNew && state.timetables.length > 1 ? `<button type="button" class="btn btn-danger left" id="tt-delete">${icon('trash')}Eliminar</button>` : ''}
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn btn-primary">${isNew ? 'Crear horario' : 'Guardar'}</button>
      </div>
    </form>`, (root) => {
    const form = $('#tt-form', root);
    if (!window.matchMedia('(pointer: coarse)').matches) form.name.focus();
    $('#tt-days', form).onchange = () => $$('#tt-days label', form).forEach((l) => l.classList.toggle('on', $('input', l).checked));
    const del = $('#tt-delete', root);
    if (del) {
      del.onclick = async () => {
        const nItems = ttItems(tt.id).length;
        const nEvents = ttEvents(tt.id).length;
        const extra = [nItems && plural(nItems, 'tarea o examen', 'tareas y exámenes'), nEvents && plural(nEvents, 'evento', 'eventos')].filter(Boolean).join(' y ');
        if (!confirm(`¿Eliminar el horario «${tt.name}»? Se borrarán sus tramos, clases y asignaturas${extra ? `, y también ${extra}` : ''}. No se puede deshacer.`)) return;
        const r = await attempt(() => api('DELETE', `/timetables/${tt.id}`), 'Horario eliminado');
        if (r) {
          state.items = state.items.filter((i) => i.timetable_id !== tt.id);
          state.events = state.events.filter((e) => e.timetable_id !== tt.id);
          applyTimetables(r);
          closeModal();
          renderView();
        }
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const visible_days = $$('#tt-days input:checked', form).map((i) => Number(i.value));
      if (!visible_days.length) { $('#form-error', form).textContent = 'Elige al menos un día de la semana'; return; }
      const body = { name: form.name.value, start_date: form.start_date.value || null, end_date: form.end_date.value || null, visible_days };
      try {
        if (isNew) {
          applyTimetables(await api('POST', '/timetables', { ...body, copy_from: form.copy_from.value ? Number(form.copy_from.value) : null }));
          toast('Horario creado');
        } else {
          state.timetables = await api('PUT', `/timetables/${tt.id}`, body);
          toast('Horario guardado');
        }
        closeModal();
        if (location.hash !== '#week') location.hash = 'week';
        else renderView();
      } catch (err) {
        $('#form-error', form).textContent = err.message;
      }
    };
  });
}

/* ============================================================
   Imagen del horario (para guardar en la galería)
   ============================================================ */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, bg, w, h) {
  const fill = (c) => { ctx.fillStyle = c; ctx.fillRect(0, 0, w, h); };
  const stripes = (a, b) => {
    fill(b);
    ctx.fillStyle = a;
    for (let x = 0; x < w; x += 120) ctx.fillRect(x, 0, 60, h);
  };
  const gradient = (x1, y1, x2, y2, a, b) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    fill(g);
  };
  switch (bg) {
    case 'rayas-rosa': return stripes('#f2dce1', '#faf1e8');
    case 'cuadricula':
      fill('#fbfaf7');
      ctx.fillStyle = '#dfe5eb';
      for (let x = 0; x < w; x += 30) ctx.fillRect(x, 0, 1.5, h);
      for (let y = 0; y < h; y += 30) ctx.fillRect(0, y, w, 1.5);
      return;
    case 'puntos':
      fill('#f8f5ef');
      ctx.fillStyle = '#cbc2b2';
      for (let x = 12; x < w; x += 24) for (let y = 12; y < h; y += 24) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
      return;
    case 'lisa': return fill('#ffffff');
    case 'arena': return fill('#eee4d5');
    case 'menta': return gradient(0, 0, w, h, '#d9efe5', '#eef7f2');
    case 'lavanda': return gradient(0, 0, w, h, '#e5def3', '#f4f1fa');
    case 'cielo': return gradient(0, 0, 0, h, '#d8e9f6', '#f1f7fc');
    case 'noche': return fill('#2a2f35');
    default: return stripes('#d8e4e5', '#f1e9e0');
  }
}

/** Parte el texto en líneas que caben en maxW. Si breakWords, corta las palabras largas con guion. */
function wrapText(ctx, text, maxW, breakWords) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxW) { line = candidate; continue; }
    if (line) lines.push(line);
    line = '';
    if (ctx.measureText(word).width <= maxW) { line = word; continue; }
    if (!breakWords) return null;
    let chunk = '';
    for (const ch of word) {
      if (chunk && ctx.measureText(`${chunk}${ch}-`).width > maxW) { lines.push(`${chunk}-`); chunk = ch; } else chunk += ch;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

/** Busca el mayor tamaño de letra con el que el texto cabe en la caja. */
function fitText(ctx, text, maxW, maxH, { start, comfy, min, weight = 500 }) {
  const attempt = (size, breakWords) => {
    ctx.font = `${weight} ${size}px Figtree, system-ui, sans-serif`;
    const lines = wrapText(ctx, text, maxW, breakWords);
    return lines && lines.length * size * 1.16 <= maxH ? { size, lines } : null;
  };
  for (let size = start; size >= comfy; size--) { const r = attempt(size, false); if (r) return r; }
  for (let size = comfy; size >= min; size--) { const r = attempt(size, true); if (r) return r; }
  ctx.font = `${weight} ${min}px Figtree, system-ui, sans-serif`;
  const lines = wrapText(ctx, text, maxW, true);
  const max = Math.max(1, Math.floor(maxH / (min * 1.16)));
  return { size: min, lines: lines.length > max ? [...lines.slice(0, max - 1), `${lines[max - 1].slice(0, -1)}…`] : lines };
}

function drawLines(ctx, fit, cx, cy, color) {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = fit.size * 1.16;
  fit.lines.forEach((l, i) => ctx.fillText(l, cx, cy - ((fit.lines.length - 1) * lh) / 2 + i * lh));
}

function darken(hex, f = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)}, ${Math.round(((n >> 8) & 255) * f)}, ${Math.round((n & 255) * f)})`;
}

function drawIcon(ctx, name, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const m of ICONS[name].matchAll(/d="([^"]+)"/g)) ctx.stroke(new Path2D(m[1]));
  ctx.restore();
}

/** Dibuja el horario en un lienzo de 1080 px de ancho, con el mismo aspecto que en pantalla. */
async function timetableCanvas(tt) {
  if (document.fonts) await document.fonts.ready;
  const days = visibleDays(tt);
  const slots = ttSlots(tt.id);
  const night = tt.background === 'noche';
  const W = 1080;
  const P = 44;
  const titleH = 104;
  const gap = 30;
  const headH = 92;
  const timeW = 118;
  const footH = 96;
  const rowH = slots.map((s) => (s.is_break ? 84 : 150));
  const gridH = headH + rowH.reduce((a, b) => a + b, 0);
  const H = P + titleH + gap + gridH + footH;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawBackground(ctx, tt.background, W, H);

  // Título
  roundRect(ctx, P, P, W - 2 * P, titleH, titleH / 2);
  ctx.fillStyle = night ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.62)';
  ctx.fill();
  const title = fitText(ctx, tt.name, W - 2 * P - 80, titleH - 24, { start: 52, comfy: 34, min: 28, weight: 650 });
  drawLines(ctx, { ...title, lines: title.lines.slice(0, 1) }, W / 2, P + titleH / 2 + 2, night ? '#f1f3f4' : '#22272b');

  // Cuadrícula
  const gx = P;
  const gy = P + titleH + gap;
  const gw = W - 2 * P;
  const dayW = (gw - timeW) / days.length;
  const colX = (j) => gx + timeW + j * dayW;
  const rowY = [];
  let acc = gy + headH;
  rowH.forEach((h, i) => { rowY[i] = acc; acc += h; });
  const line = night ? '#15181b' : '#45494d';
  const cells = [];
  const box = (x, y, w, h, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    cells.push([x, y, w, h]);
  };

  box(gx, gy, timeW, headH, '#3b3e42');
  days.forEach((d, j) => {
    box(colX(j), gy, dayW, headH, '#76797d');
    ctx.font = '600 40px Figtree, system-ui, sans-serif';
    drawLines(ctx, { size: 40, lines: [DAY_SHORT[d]] }, colX(j) + dayW / 2, gy + headH / 2 + 2, '#ffffff');
  });

  const timeFill = night ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.84)';
  const timeInk = night ? '#dfe3e6' : '#2b2f33';
  let number = 0;
  slots.forEach((s, i) => {
    const y = rowY[i];
    const h = rowH[i];
    box(gx, y, timeW, h, timeFill);
    if (s.is_break) {
      drawIcon(ctx, 'cup', gx + timeW / 2 - 18, y + h / 2 - 18, 36, '#8a8e92');
      days.forEach((d, j) => {
        box(colX(j), y, dayW, h, night ? '#4a5057' : '#c4c7ca');
        const fit = fitText(ctx, (s.label || 'Descanso').toUpperCase(), dayW - 16, h - 16, { start: 30, comfy: 18, min: 14, weight: 650 });
        drawLines(ctx, fit, colX(j) + dayW / 2, y + h / 2 + 1, night ? '#d8dcdf' : '#ffffff');
      });
      return;
    }
    number += 1;
    ctx.fillStyle = timeInk;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = '500 26px Figtree, system-ui, sans-serif';
    ctx.fillText(s.start_time, gx + 12, y + 36);
    ctx.textAlign = 'right';
    ctx.font = '650 54px Figtree, system-ui, sans-serif';
    ctx.fillText(String(s.label.match(/\d+/)?.[0] ?? number), gx + timeW - 12, y + h - 16);
  });

  days.forEach((d, j) => {
    for (const b of dayBlocks(d, slots)) {
      const x = colX(j);
      const y = rowY[b.row];
      const h = rowH.slice(b.row, b.row + b.span).reduce((a, c) => a + c, 0);
      if (!b.subject) { cells.push([x, y, dayW, h]); continue; }
      const color = b.subject.color;
      const ink = textOn(color);
      box(x, y, dayW, h, color);
      const band = b.room ? 52 : 0;
      if (band) {
        ctx.fillStyle = darken(color);
        ctx.fillRect(x, y + h - band, dayW, band);
        const rf = fitText(ctx, b.room, dayW - 14, band - 8, { start: 28, comfy: 18, min: 14, weight: 500 });
        drawLines(ctx, { ...rf, lines: rf.lines.slice(0, 1) }, x + dayW / 2, y + h - band / 2 + 1, ink);
      }
      const nf = fitText(ctx, b.subject.name, dayW - 16, h - band - 14, { start: 38, comfy: 24, min: 17, weight: 500 });
      drawLines(ctx, nf, x + dayW / 2, y + (h - band) / 2 + 1, ink);
    }
  });

  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  for (const [x, y, w, h] of cells) ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 6;
  ctx.strokeRect(gx, gy, gw, gridH);

  // Marca
  const fy = gy + gridH + 26;
  ctx.font = '600 34px Fraunces, Georgia, serif';
  const wordW = ctx.measureText('Horaria').width;
  const pillW = 44 + 14 + wordW + 40;
  const px = W - P - pillW;
  roundRect(ctx, px, fy, pillW, 60, 30);
  ctx.fillStyle = night ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.62)';
  ctx.fill();
  ctx.save();
  ctx.translate(px + 20, fy + 8);
  ctx.scale(44 / 32, 44 / 32);
  roundRect(ctx, 0, 0, 32, 32, 9);
  ctx.fillStyle = '#2c5f6f';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D('M10.5 9.5v13M21.5 9.5v13M10.5 16h11'));
  ctx.beginPath();
  ctx.arc(25, 7.5, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = '#d9784c';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = night ? '#f1f3f4' : '#1f2b30';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 34px Fraunces, Georgia, serif';
  ctx.fillText('Horaria', px + 20 + 44 + 14, fy + 31);
  return canvas;
}

async function openDownloadModal() {
  const tt = activeTT();
  if (!ttSlots(tt.id).length) return toast('Este horario aún no tiene tramos', true);
  const canvas = await timetableCanvas(tt);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  // Nombre de archivo con caracteres seguros (algunos navegadores rechazan «º», «ª» o tildes).
  const safeName = `Horaria - ${tt.name}`
    .replace(/º/g, 'o').replace(/ª/g, 'a')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ._()-]+/g, '').replace(/\s+/g, ' ').trim();
  const fileName = `${safeName || 'Horaria'}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });
  const canShare = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
  const url = URL.createObjectURL(blob);
  const hint = canShare
    ? isIOS()
      ? 'Pulsa «Guardar en la galería» y elige «Guardar imagen». También puedes mantener pulsada la imagen.'
      : 'Pulsa «Guardar en la galería» y elige dónde guardarla: Galería, Fotos, Drive…'
    : 'La imagen se guardará en tu carpeta de descargas.';
  openModal(`
    <div class="modal-head"><h2>Descargar horario</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
    <img class="tt-preview" src="${url}" alt="${esc(`Horario ${tt.name}`)}">
    <p class="hint" style="margin:12px 0 0">${hint}</p>
    <div class="modal-foot">
      ${canShare
        ? `<button class="btn" id="dl-file">${icon('download')}Descargar</button><button class="btn btn-primary" id="dl-share">Guardar en la galería</button>`
        : `<button class="btn btn-primary" id="dl-file">${icon('download')}Descargar imagen</button>`}
    </div>`, (root) => {
    $('#dl-file', root).onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.append(a);
      a.click();
      a.remove();
      toast('Imagen descargada');
    };
    const share = $('#dl-share', root);
    if (share) {
      share.onclick = async () => {
        try {
          await navigator.share({ files: [file], title: tt.name });
        } catch (err) {
          if (err.name !== 'AbortError') toast('No se pudo abrir el menú para guardar la imagen', true);
        }
      };
    }
  });
}

/* ============================================================
   Eventos (conferencias, excursiones, charlas…)
   ============================================================ */
const EVENT_COLORS = ['#7461a6', '#3a7aa6', '#2e8a8a', '#3f8c66', '#e0a43a', '#e07b3c', '#c8553d', '#c45a74'];

function eventCard(ev) {
  return `<article class="card event-card" data-event="${ev.id}" style="--c:${ev.color}">
    <span class="ev-icon">${icon('event')}</span>
    <div class="body">
      <div class="meta">
        <span class="badge event">Evento</span>
        <span>${icon('clock')}${esc(eventTimeLabel(ev))}</span>
        ${ev.location ? `<span>${icon('pin')}${esc(ev.location)}</span>` : ''}
        ${ev.reminder_minutes !== null ? `<span title="Con aviso">${ev.reminder_sent ? icon('sent') : icon('bell')}</span>` : ''}
      </div>
      <h3>${esc(ev.title)}</h3>
      ${ev.description ? `<p class="desc">${esc(ev.description)}</p>` : ''}
    </div>
    <button class="icon-btn" data-event="${ev.id}" title="Editar" aria-label="Editar">${icon('pencil')}</button>
  </article>`;
}

/** Crear (ev = null) o editar un evento. */
function openEventModal(ev, defaults = {}) {
  const isNew = !ev;
  const tt = state.timetables.find((t) => t.id === ev?.timetable_id) || activeTT();
  const start = ev ? new Date(ev.start_at) : null;
  const end = ev?.end_at ? new Date(ev.end_at) : null;
  const d = {
    title: ev?.title || '',
    location: ev?.location || '',
    description: ev?.description || '',
    color: ev?.color || EVENT_COLORS[0],
    allDay: ev?.all_day || false,
    date: start ? dateKey(start) : defaults.date || dateKey(new Date()),
    time: start && !ev.all_day ? timeOf(start) : '10:00',
    endDate: end && dateKey(end) !== dateKey(start) ? dateKey(end) : '',
    endTime: end && !ev.all_day ? timeOf(end) : '',
    reminder: ev ? ev.reminder_minutes : state.user.default_reminder_minutes,
  };
  openModal(`
    <form id="event-form" novalidate>
      <div class="modal-head"><div class="head-text"><h2>${isNew ? 'Nuevo evento' : 'Editar evento'}</h2>${state.timetables.length > 1 ? `<small class="hint">${esc(tt.name)}</small>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <label class="field"><span>Título</span><input type="text" name="title" value="${esc(d.title)}" placeholder="Ej.: Conferencia de marketing digital" required></label>
      <div class="row">
        <label class="field"><span>Fecha</span><input type="date" name="date" value="${d.date}" required></label>
        <label class="field time-field"><span>Hora de inicio</span><input type="time" name="time" value="${d.time}"></label>
      </div>
      <label class="check-line"><input type="checkbox" name="all_day" ${d.allDay ? 'checked' : ''}><span>Todo el día</span></label>
      <div class="row">
        <label class="field"><span>Termina el día (opcional)</span><input type="date" name="end_date" value="${d.endDate}"></label>
        <label class="field time-field"><span>Hora de fin (opcional)</span><input type="time" name="end_time" value="${d.endTime}"></label>
      </div>
      <label class="field"><span>Lugar</span><input type="text" name="location" value="${esc(d.location)}" placeholder="Ej.: Auditorio de la facultad"></label>
      <div class="field"><span>Color</span>
        <div class="swatches" id="ev-colors">${EVENT_COLORS.map((c) => `<button type="button" class="swatch ${c === d.color ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
        <input type="hidden" name="color" value="${d.color}">
      </div>
      <label class="field"><span>Aviso</span>
        <select name="reminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${v === d.reminder ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Notas</span><textarea name="description" placeholder="Ponentes, qué llevar, enlace de inscripción…">${esc(d.description)}</textarea></label>
      <div class="error" id="form-error"></div>
      <div class="modal-foot">
        ${isNew ? '' : `<button type="button" class="btn btn-danger left" id="ev-delete">${icon('trash')}Eliminar</button>`}
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn btn-primary">Guardar</button>
      </div>
    </form>`, (root) => {
    const form = $('#event-form', root);
    const err = $('#form-error', form);
    const syncAllDay = () => $$('.time-field', form).forEach((f) => { f.hidden = form.all_day.checked; });
    syncAllDay();
    form.all_day.onchange = syncAllDay;
    if (!window.matchMedia('(pointer: coarse)').matches && isNew) setTimeout(() => form.title.focus(), 0);
    $('#ev-colors', form).onclick = (e) => {
      const b = e.target.closest('.swatch');
      if (!b) return;
      form.color.value = b.dataset.color;
      $$('#ev-colors .swatch', form).forEach((x) => x.classList.toggle('active', x === b));
    };
    const finish = () => {
      closeModal();
      renderView();
      if (defaults.returnTo) openDayModal(defaults.returnTo);
    };
    const del = $('#ev-delete', form);
    if (del) {
      del.onclick = async () => {
        if (!confirm(`¿Eliminar el evento «${ev.title}»?`)) return;
        if ((await attempt(() => api('DELETE', `/events/${ev.id}`), 'Evento eliminado')) === undefined) return;
        state.events = state.events.filter((x) => x.id !== ev.id);
        finish();
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!form.title.value.trim()) { err.textContent = 'Escribe un título'; form.title.focus(); return; }
      if (!form.date.value) { err.textContent = 'Indica la fecha'; return; }
      const allDay = form.all_day.checked;
      const startLocal = new Date(`${form.date.value}T${allDay ? '00:00' : form.time.value || '00:00'}`);
      let endLocal = null;
      if (allDay) {
        if (form.end_date.value && form.end_date.value !== form.date.value) endLocal = new Date(`${form.end_date.value}T23:59`);
      } else if (form.end_date.value || form.end_time.value) {
        endLocal = new Date(`${form.end_date.value || form.date.value}T${form.end_time.value || form.time.value || '00:00'}`);
      }
      if (endLocal && endLocal < startLocal) { err.textContent = 'El final debe ser posterior al inicio'; return; }
      const payload = {
        timetable_id: tt.id,
        title: form.title.value,
        location: form.location.value,
        description: form.description.value,
        color: form.color.value,
        all_day: allDay,
        start_at: startLocal.toISOString(),
        end_at: endLocal ? endLocal.toISOString() : null,
        reminder_minutes: form.reminder.value === '' ? null : Number(form.reminder.value),
      };
      try {
        upsertEvent(isNew ? await api('POST', '/events', payload) : await api('PUT', `/events/${ev.id}`, payload));
        toast(isNew ? 'Evento añadido' : 'Cambios guardados');
        finish();
      } catch (ex) {
        err.textContent = ex.message;
      }
    };
  });
}

/* ============================================================
   Lista de tareas y exámenes
   ============================================================ */
function itemCard(item) {
  const d = new Date(item.due_at);
  const s = subjectById(item.subject_id);
  const done = item.checklist.filter((c) => c.done).length;
  const overdue = !item.done && d < new Date();
  const rem = REMINDERS.find(([v]) => v === item.reminder_minutes);
  return `<article class="card item-card ${item.done ? 'done' : ''}" style="--c:${s ? s.color : 'var(--border)'}">
    <input type="checkbox" data-toggle="${item.id}" ${item.done ? 'checked' : ''} aria-label="Marcar como hecha">
    <div class="body">
      <div class="meta">
        <span class="badge ${item.type}">${item.type === 'exam' ? 'Examen' : 'Tarea'}</span>
        ${s ? `<span><span class="dot" style="--c:${s.color}"></span> ${esc(subjectLabel(s))}</span>` : ''}
        <span>${icon('clock')}${esc(fmtDateTime(d))}</span>
        <span class="${overdue ? 'overdue' : ''}">${overdue ? 'Vencida ' : ''}${esc(relative(d))}</span>
        ${item.reminder_minutes !== null ? `<span title="Aviso: ${esc(rem ? rem[1] : `${item.reminder_minutes} min antes`)}">${item.reminder_sent ? icon('sent') : icon('bell')}</span>` : ''}
      </div>
      <h3 data-edit="${item.id}">${esc(item.title)}</h3>
      ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ''}
      ${item.checklist.length ? `
        <ul class="checklist">${item.checklist.map((c) => `<li><label class="${c.done ? 'done' : ''}"><input type="checkbox" data-check="${c.id}" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span></label></li>`).join('')}</ul>
        <div class="progress" title="${done}/${item.checklist.length}"><div style="width:${Math.round((done / item.checklist.length) * 100)}%"></div></div>` : ''}
    </div>
    <button class="icon-btn" data-edit="${item.id}" title="Editar" aria-label="Editar">${icon('pencil')}</button>
  </article>`;
}

function itemsView() {
  const f = state.filter;
  const tt = activeTT();
  const subjects = ttSubjects(tt.id);
  const ids = new Set(subjects.flatMap((s) => [s.id, ...subsOf(s.id).map((c) => c.id)]));
  if (f.subject && !ids.has(Number(f.subject))) f.subject = '';
  const list = ttItems(tt.id).filter((i) => (f.type === 'all' || i.type === f.type) && (!f.subject || i.subject_id === Number(f.subject) || subjectById(i.subject_id)?.parent_id === Number(f.subject)));
  const now = new Date();
  const todayKey = dateKey(now);
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  const pending = list.filter((i) => !i.done);
  const groups = [
    ['Vencidas', pending.filter((i) => new Date(i.due_at) < now), 'danger'],
    ['Hoy', pending.filter((i) => new Date(i.due_at) >= now && dateKey(new Date(i.due_at)) === todayKey)],
    ['Próximos 7 días', pending.filter((i) => dateKey(new Date(i.due_at)) > todayKey && new Date(i.due_at) < in7)],
    ['Más adelante', pending.filter((i) => new Date(i.due_at) >= in7)],
  ];
  if (f.showDone) groups.push(['Completadas', list.filter((i) => i.done).reverse()]);
  const body = groups
    .filter(([, items]) => items.length)
    .map(([title, items, cls]) => `<div class="group-title ${cls || ''}">${title} <span>(${items.length})</span></div>${items.map(itemCard).join('')}`)
    .join('');
  const opt = (s, indent) => `<option value="${s.id}" ${String(s.id) === f.subject ? 'selected' : ''}>${indent ? '\u00a0\u00a0\u00a0↳ ' : ''}${esc(s.name)}</option>`;
  return `
    <div class="toolbar tt-toolbar">
      ${ttSwitcher()}
      <span class="spacer"></span>
      <button class="btn btn-primary hide-mobile" data-action="newItem" data-type="task">${icon('plus')}Tarea</button>
      <button class="btn btn-exam hide-mobile" data-action="newItem" data-type="exam">${icon('plus')}Examen</button>
    </div>
    <div class="toolbar items-toolbar">
      <div class="segmented" id="type-filter">
        ${[['all', 'Todo'], ['task', 'Tareas'], ['exam', 'Exámenes']].map(([v, l]) => `<button data-type="${v}" class="${f.type === v ? 'active' : ''}">${l}</button>`).join('')}
      </div>
      <select id="subject-filter" aria-label="Asignatura">
        <option value="">Todas las asignaturas</option>
        ${subjects.map((s) => opt(s, false) + subsOf(s.id).map((c) => opt(c, true)).join('')).join('')}
      </select>
      <label class="toggle"><input type="checkbox" id="show-done" ${f.showDone ? 'checked' : ''}> <span class="long">Mostrar completadas</span><span class="short">Hechas</span></label>
    </div>
    <div class="scroll">${body || (f.type !== 'all' || f.subject ? '<div class="empty"><strong>Nada por aquí</strong>No hay nada pendiente con estos filtros.</div>' : '<div class="empty"><strong>Todo al día</strong>No tienes tareas ni exámenes pendientes en este horario.</div>')}</div>
    <button class="fab show-mobile" data-action="newItem" data-type="task" aria-label="Añadir tarea o examen">${icon('plus')}</button>`;
}
document.addEventListener('change', (e) => {
  if (e.target.id !== 'tt-select') return;
  if (e.target.value === '__new') {
    e.target.value = String(activeTT().id);
    openTimetableModal(null);
  } else {
    setActiveTimetable(Number(e.target.value));
  }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('#type-filter button');
  if (b) { state.filter.type = b.dataset.type; renderView(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'subject-filter') { state.filter.subject = e.target.value; renderView(); }
  if (e.target.id === 'show-done') { state.filter.showDone = e.target.checked; setPref('showDone', e.target.checked); renderView(); }
});

/* ============================================================
   Asignaturas
   ============================================================ */
function subjectsView() {
  const activeSlots = ttSlots(activeTT().id);
  const hours = (id) =>
    state.schedule.filter((e) => (e.subject_id === id || subjectById(e.subject_id)?.parent_id === id) && activeSlots.some((s) => s.id === e.slot_id)).length;
  const list = ttSubjects(activeTT().id);
  return `
    <div class="toolbar tt-toolbar">
      ${ttSwitcher()}
      <span class="spacer"></span>
      <button class="btn btn-primary" data-action="newSubject">${icon('plus')}<span class="long">Nueva asignatura</span><span class="short">Nueva</span></button>
    </div>
    <p class="hint view-hint">Asignaturas de este horario. Cada horario tiene las suyas.</p>
    <div class="scroll">
      ${list.length ? `<div class="subjects-grid">${list.map((s) => `
        <div class="card subject-card" style="--c:${s.color}">
          <h3>${esc(s.name)}<span class="abbr">${esc(shortName(s))}</span></h3>
          <div class="info">${icon('pin')}${s.room ? `Aula ${esc(s.room)}` : 'Sin aula'}</div>
          <div class="info">${icon('user')}${esc(s.teacher || 'Sin profesor asignado')}</div>
          <div class="info">${icon('clock')}${plural(hours(s.id), 'clase', 'clases')} a la semana</div>
          <div class="subs">
            ${subsOf(s.id).map((c) => `<button type="button" class="sub-chip" data-action="editSubject" data-id="${c.id}" style="--c:${c.color}" title="Editar ${esc(c.name)}"><i></i>${esc(c.name)}${c.room ? `<small>${esc(c.room)}</small>` : ''}</button>`).join('')}
            <button type="button" class="sub-chip add" data-action="newSub" data-parent="${s.id}">${icon('plus')}Subasignatura</button>
          </div>
          <div class="actions">
            <button class="btn btn-sm" data-action="editSubject" data-id="${s.id}">${icon('pencil')}Editar</button>
            <button class="btn btn-sm btn-danger" data-action="deleteSubject" data-id="${s.id}">${icon('trash')}Eliminar</button>
          </div>
        </div>`).join('')}</div>`
      : '<div class="empty"><strong>Empieza por tus asignaturas</strong>Añade cada una con su aula, profesor y color, y luego colócalas en el horario.</div>'}
    </div>`;
}

async function deleteSubjectFlow(s) {
  const subs = subsOf(s.id).length;
  const what = s.parent_id ? 'la subasignatura' : 'la asignatura';
  if (!confirm(`¿Eliminar ${what} «${s.name}»?${subs === 1 ? ' También se borrará su subasignatura.' : subs > 1 ? ` También se borrarán sus ${subs} subasignaturas.` : ''} Se quitará del horario y sus tareas quedarán sin asignatura.`)) return false;
  if ((await attempt(() => api('DELETE', `/subjects/${s.id}`), s.parent_id ? 'Subasignatura eliminada' : 'Asignatura eliminada')) === undefined) return false;
  await loadAll();
  renderView();
  return true;
}

/** Crear o editar una asignatura; con `parent`, una subasignatura de esa asignatura. */
function openSubjectModal(subject, parent = null) {
  parent = parent || parentOf(subject);
  const s = subject || {
    name: '', short_name: '', room: '', teacher: '',
    color: parent ? parent.color : PALETTE[(ttSubjects(activeTT().id).length * 5) % PALETTE.length],
  };
  const inherit = (value, label) => (parent ? `Igual que ${parent.name}${value ? ` (${value})` : ''}` : label);
  const title = subject ? (parent ? 'Editar subasignatura' : 'Editar asignatura') : parent ? `Nueva subasignatura de ${parent.name}` : 'Nueva asignatura';
  openModal(`
    <form id="subject-form">
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="row">
        <label class="field" style="flex:3"><span>Nombre</span><input type="text" name="name" value="${esc(s.name)}" required placeholder="${parent ? 'Química' : 'Matemáticas'}"></label>
        <label class="field" style="flex:1"><span>Abreviatura</span><input type="text" name="short_name" value="${esc(s.short_name)}" placeholder="MAT"></label>
      </div>
      <div class="row">
        <label class="field"><span>Aula</span><input type="text" name="room" value="${esc(s.room)}" placeholder="${esc(inherit(parent?.room, 'B-12'))}"></label>
        <label class="field"><span>Profesor/a</span><input type="text" name="teacher" value="${esc(s.teacher)}" placeholder="${esc(inherit(parent?.teacher, 'Ana García'))}"></label>
      </div>
      ${parent ? `<p class="hint" style="margin:-6px 0 14px">Si dejas el aula o el profesor vacíos, se usan los de «${esc(parent.name)}».</p>` : ''}
      <div class="field"><span>Color</span>
        <div class="swatches">
          ${PALETTE.map((c) => `<button type="button" class="swatch ${c === s.color ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
          <input type="color" name="color" value="${esc(s.color)}" title="Color personalizado">
        </div>
      </div>
      <div class="error" id="form-error"></div>
      <div class="modal-foot">
        ${subject ? `<button type="button" class="btn btn-danger left" id="subj-delete">${icon('trash')}Eliminar</button>` : ''}
        <button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button>
      </div>
    </form>`, (root) => {
    const form = $('#subject-form', root);
    if (!window.matchMedia('(pointer: coarse)').matches) $('input[name=name]', form).focus();
    const del = $('#subj-delete', form);
    if (del) del.onclick = async () => { if (await deleteSubjectFlow(subject)) closeModal(); };
    $('.swatches', form).onclick = (e) => {
      const b = e.target.closest('.swatch');
      if (!b) return;
      form.color.value = b.dataset.color;
      $$('.swatch', form).forEach((x) => x.classList.toggle('active', x === b));
    };
    form.color.oninput = () => $$('.swatch', form).forEach((x) => x.classList.toggle('active', x.dataset.color === form.color.value));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        const saved = subject
          ? await api('PUT', `/subjects/${subject.id}`, data)
          : await api('POST', '/subjects', { ...data, timetable_id: parent ? parent.timetable_id : activeTT().id, parent_id: parent?.id ?? null });
        const i = state.subjects.findIndex((x) => x.id === saved.id);
        if (i >= 0) state.subjects[i] = saved; else state.subjects.push(saved);
        state.subjects.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        closeModal();
        refresh();
        toast(parent ? 'Subasignatura guardada' : 'Asignatura guardada');
      } catch (err) {
        $('#form-error', form).textContent = err.message;
      }
    };
  });
}

/* ============================================================
   Ajustes
   ============================================================ */
function settingsView() {
  const u = state.user;
  return `<div class="scroll"><div class="settings">
    ${state.timetables.length > 1 ? `<section class="card tt-card">
      <label class="field tt-field"><span>Estás editando los días y tramos de</span><select id="s-tt">${state.timetables.map((t) => `<option value="${t.id}" ${t.id === activeTT().id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <p class="hint" style="margin:0">Cada horario tiene sus propios días y tramos.</p>
    </section>` : ''}
    <section class="card">
      <h2>Días de la semana</h2>
      <p class="hint">Días que aparecen en «${esc(activeTT().name)}».</p>
      <div class="days-pick">${DAY_ORDER.map((d) => `<label class="${ttDays(activeTT()).includes(d) ? 'on' : ''}"><input type="checkbox" data-day="${d}" ${ttDays(activeTT()).includes(d) ? 'checked' : ''}> ${DAY_LONG[d]}</label>`).join('')}</div>
    </section>

    <section class="card">
      <h2>Tramos horarios</h2>
      <p class="hint">Horas de clase y descansos de «${esc(activeTT().name)}». Cuando termines, pulsa «Guardar cambios».</p>
      <div id="slots">${ttSlots(activeTT().id).map((s) => `
        <div class="slot-row" data-slot="${s.id}">
          <input type="time" name="start_time" value="${s.start_time}" aria-label="Inicio">
          <input type="time" name="end_time" value="${s.end_time}" aria-label="Fin">
          <input type="text" name="label" value="${esc(s.label)}" placeholder="Etiqueta (opcional)">
          <label class="brk"><input type="checkbox" name="is_break" ${s.is_break ? 'checked' : ''}> Descanso</label>
          <button class="icon-btn" data-del-slot="${s.id}" title="Eliminar tramo" aria-label="Eliminar tramo">${icon('trash')}</button>
        </div>`).join('') || '<p class="hint">No hay tramos.</p>'}</div>
      <div class="slots-save" id="slots-save" hidden>
        <span class="hint">Tienes cambios sin guardar.</span>
        <button class="btn" id="discard-slots">Descartar</button>
        <button class="btn btn-primary" id="save-slots">Guardar cambios</button>
      </div>
      <button class="btn" id="add-slot">${icon('plus')}Añadir tramo</button>
    </section>

    <section class="card">
      <h2>Avisos</h2>
      <p class="hint">Recibe los recordatorios de tus tareas y exámenes como notificación, por correo o de las dos formas.</p>

      <h3 class="sub-title">${icon('bell')}Notificaciones en este dispositivo</h3>
      <div id="push-box" class="push-box"><span class="hint">Comprobando…</span></div>

      <h3 class="sub-title">${icon('mail')}Correo</h3>
      ${state.mailConfigured ? '' : `<div class="status warn">${icon('alert')}<span>El servidor todavía no tiene configurado el envío de correo (SMTP). Los avisos se registrarán en la consola del servidor hasta que se configure.</span></div>`}
      <label class="check-line"><input type="checkbox" id="s-notify" ${u.email_notifications ? 'checked' : ''}><span>Enviar los avisos también a <b>${esc(u.email)}</b></span></label>
      <button class="btn btn-sm" id="test-email">${icon('mail')}Enviar correo de prueba</button>

      <h3 class="sub-title">${icon('clock')}Cuándo avisar</h3>
      <label class="field"><span>Aviso por defecto para nuevas tareas y exámenes</span>
        <select id="s-default-rem">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${v === u.default_reminder_minutes ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check-line"><input type="checkbox" id="s-digest" ${u.daily_digest ? 'checked' : ''}> Resumen diario con lo pendiente de los próximos 7 días</label>
      <div class="row">
        <label class="field"><span>Hora del resumen</span>
          <select id="s-digest-hour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === u.digest_hour ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
        <label class="field"><span>Zona horaria</span><input type="text" id="s-tz" value="${esc(u.timezone)}" list="tz-list"></label>
      </div>
      <datalist id="tz-list">${(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).map((z) => `<option value="${z}">`).join('')}</datalist>
    </section>

    <section class="card">
      <h2>Cuenta</h2>
      <label class="field"><span>Nombre</span><input type="text" id="s-name" value="${esc(u.name)}"></label>
      <form id="pw-form">
        <div class="row">
          <label class="field"><span>Contraseña actual</span><input type="password" name="current" autocomplete="current-password" required></label>
          <label class="field"><span>Nueva contraseña</span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
        </div>
        <button class="btn">Cambiar contraseña</button>
      </form>
    </section>
  </div></div>`;
}

function bindSettings(root) {
  const saveSettings = async (patch) => {
    const r = await attempt(() => api('PUT', '/me/settings', patch), 'Ajustes guardados');
    if (r) state.user = r.user;
    return r;
  };
  $('.days-pick', root).onchange = async () => {
    const days = $$('.days-pick input:checked', root).map((i) => Number(i.dataset.day));
    const r = await attempt(() => api('PUT', `/timetables/${activeTT().id}`, { visible_days: days }), 'Días guardados');
    if (r) {
      state.timetables = r;
      $$('.days-pick label', root).forEach((l) => l.classList.toggle('on', $('input', l).checked));
    } else renderView();
  };
  // Los tramos no se guardan en cada cambio: en el móvil eso cerraba el selector de hora
  // a mitad de escribir. Se marcan como pendientes y se guardan con el botón.
  const markDirty = (e) => {
    const row = e.target.closest('.slot-row');
    if (!row) return;
    row.classList.add('dirty');
    $('#slots-save', root).hidden = false;
  };
  $('#slots', root).addEventListener('input', markDirty);
  $('#slots', root).addEventListener('change', markDirty);
  const saveSlots = async () => {
    let slots = null;
    for (const row of $$('.slot-row.dirty', root)) {
      const data = {
        start_time: $('[name=start_time]', row).value,
        end_time: $('[name=end_time]', row).value,
        label: $('[name=label]', row).value,
        is_break: $('[name=is_break]', row).checked,
      };
      try {
        slots = await api('PUT', `/slots/${row.dataset.slot}`, data);
        row.classList.remove('dirty');
      } catch (err) {
        if (slots) state.slots = slots;
        toast(`${data.start_time || '--:--'}–${data.end_time || '--:--'}: ${err.message}`, true);
        return false;
      }
    }
    if (slots) state.slots = slots;
    return true;
  };
  const savePending = async () => !$$('.slot-row.dirty', root).length || saveSlots();
  $('#save-slots', root).onclick = async () => {
    if (await saveSlots()) {
      toast('Tramos guardados');
      renderView();
    }
  };
  $('#discard-slots', root).onclick = () => renderView();
  $('#slots', root).onclick = async (e) => {
    const b = e.target.closest('[data-del-slot]');
    if (!b || !confirm('¿Eliminar este tramo? Se quitarán las clases asignadas a él.')) return;
    if (!(await savePending())) return;
    const slots = await attempt(() => api('DELETE', `/slots/${b.dataset.delSlot}`), 'Tramo eliminado');
    if (slots) { state.slots = slots; state.schedule = await api('GET', '/schedule'); renderView(); }
  };
  $('#add-slot', root).onclick = async () => {
    if (!(await savePending())) return;
    const own = ttSlots(activeTT().id);
    const last = own[own.length - 1];
    let start = last ? last.end_time : '08:00';
    const [h, m] = start.split(':').map(Number);
    let endMin = Math.min(h * 60 + m + 55, 23 * 60 + 59);
    if (endMin <= h * 60 + m) start = '22:00', endMin = 22 * 60 + 55;
    const slots = await attempt(() => api('POST', '/slots', { timetable_id: activeTT().id, start_time: start, end_time: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`, label: '' }), 'Tramo añadido');
    if (slots) { state.slots = slots; renderView(); }
  };
  const ttSel = $('#s-tt', root);
  if (ttSel) ttSel.onchange = async () => { if (await savePending()) setActiveTimetable(Number(ttSel.value)); };
  $('#s-notify', root).onchange = (e) => saveSettings({ email_notifications: e.target.checked });
  $('#s-default-rem', root).onchange = (e) => saveSettings({ default_reminder_minutes: e.target.value === '' ? null : Number(e.target.value) });
  $('#s-digest', root).onchange = (e) => saveSettings({ daily_digest: e.target.checked });
  $('#s-digest-hour', root).onchange = (e) => saveSettings({ digest_hour: Number(e.target.value) });
  $('#s-tz', root).onchange = async (e) => { if (!(await saveSettings({ timezone: e.target.value.trim() }))) e.target.value = state.user.timezone; };
  $('#s-name', root).onchange = async (e) => {
    if (await saveSettings({ name: e.target.value })) {
      $('.userbox .name').textContent = state.user.name;
      $('.userbox .avatar').textContent = initials(state.user.name);
      $('.um-name').textContent = state.user.name;
    }
  };
  renderPushBox();
  $('#test-email', root).onclick = async (e) => {
    e.target.disabled = true;
    const r = await attempt(() => api('POST', '/me/test-email'));
    e.target.disabled = false;
    if (r) toast(r.mail_configured ? `Correo de prueba enviado a ${state.user.email}` : 'SMTP sin configurar: el correo se ha mostrado en la consola del servidor');
  };
  $('#pw-form', root).onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if ((await attempt(() => api('PUT', '/me/password', fd), 'Contraseña actualizada')) !== undefined) e.target.reset();
  };
}

/* ============================================================
   Modales
   ============================================================ */
let modalRefresh = null;
let openDayKey = null;
function openModal(html, onMount, refreshFn = null) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  modalRefresh = refreshFn;
  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  backdrop.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  fitModalToViewport(backdrop);
  onMount?.($('.modal', root));
}

/*
 * Con el teclado abierto, el móvil reduce la zona visible pero no la página. La ventana se
 * ajusta a la zona visible para que su parte de arriba nunca quede fuera de la pantalla.
 */
let stopViewportFit = null;
function fitModalToViewport(backdrop) {
  stopViewportFit?.();
  const vv = window.visualViewport;
  if (!vv) return;
  const sync = () => {
    backdrop.style.top = `${vv.offsetTop}px`;
    backdrop.style.height = `${vv.height}px`;
    backdrop.style.bottom = 'auto';
  };
  sync();
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  stopViewportFit = () => {
    vv.removeEventListener('resize', sync);
    vv.removeEventListener('scroll', sync);
    stopViewportFit = null;
  };
}
// Al enfocar un campo dentro de la ventana, se desplaza para que quede a la vista.
document.addEventListener('focusin', (e) => {
  if (!e.target.closest?.('.modal') || !e.target.matches('input, textarea, select')) return;
  setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 300);
});

function closeModal() {
  stopViewportFit?.();
  $('#modal-root').innerHTML = '';
  modalRefresh = null;
  openDayKey = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal(); });

/** Detalle de un día: clases + tareas/exámenes. */
function dayDetail(key, inModal) {
    const date = parseKey(key);
    const dayTT = activeTT();
    const classes = classesOnDate(dayTT, date);
    const items = ttItems(dayTT.id).filter((i) => dateKey(new Date(i.due_at)) === key);
    const dayEvents = ttEvents(dayTT.id).filter((ev) => eventDayKeys(ev).includes(key));
    return `
      <div class="modal-head"><h2>${esc(cap(fmtLongDate(date)))}</h2>${inModal ? `<button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button>` : ''}</div>
      <div class="group-title" style="margin-top:0">Clases</div>
      ${classes.length ? `<div class="day-classes">${classes.map(({ slot, subject, entry }) => `
        <div class="day-class" style="--c:${subject.color}">
          <span class="time">${slot.start_time} – ${slot.end_time}</span>
          <div><b>${esc(subjectLabel(subject))}</b><div class="info">${entry.room_override || effRoom(subject) ? `<span>${icon('pin')}${esc(entry.room_override || effRoom(subject))}</span>` : ''}${effTeacher(subject) ? `<span>${icon('user')}${esc(effTeacher(subject))}</span>` : ''}</div></div>
        </div>`).join('')}</div>` : `<p class="hint">${!ttCovers(dayTT, date) ? `«${esc(dayTT.name)}» no tiene clases en esta fecha.` : ttDays(dayTT).includes(date.getDay()) ? 'No hay clases este día.' : `Este día no está en «${esc(dayTT.name)}».`}</p>`}
      ${dayEvents.length ? `<div class="group-title">Eventos</div>${dayEvents.map(eventCard).join('')}` : ''}
      <div class="group-title">Tareas y exámenes</div>
      ${items.map(itemCard).join('') || '<p class="hint">Nada para este día.</p>'}
      <div class="modal-foot day-actions">
        <button class="btn btn-primary" data-action="newItem" data-type="task" data-date="${key}">${icon('plus')}Tarea</button>
        <button class="btn btn-exam" data-action="newItem" data-type="exam" data-date="${key}">${icon('plus')}Examen</button>
        <button class="btn btn-event" data-action="newEvent" data-date="${key}">${icon('plus')}Evento</button>
      </div>`;
}

function openDayModal(key) {
  const render = () => dayDetail(key, true);
  openModal(render(), (root) => bindViewEvents(root), () => {
    const modal = $('#modal-root .modal');
    if (modal) modal.innerHTML = render();
  });
  openDayKey = key;
}

/** Asignar asignatura a una celda del horario semanal. */
/** Asignatura de una o varias casillas del horario (cells: [{ day, slotIds }]). */
function openSlotModal(cells) {
  const targets = cells.flatMap((c) => c.slotIds.map((id) => ({ day: c.day, slot: state.slots.find((s) => s.id === id) })));
  const entries = targets.map((x) => state.schedule.find((e) => e.slot_id === x.slot.id && e.day === x.day) || null);
  const subjectIds = [...new Set(entries.map((e) => e?.subject_id ?? null))];
  const rooms = [...new Set(entries.map((e) => e?.room_override || ''))];
  // undefined = tienen asignaturas distintas y aún no se ha elegido ninguna
  let selected = subjectIds.length === 1 ? subjectIds[0] : undefined;
  const mixedRooms = rooms.length > 1;
  const many = cells.length > 1;
  const options = ttSubjects(targets[0].slot.timetable_id);
  const subRow = () => {
    const top = topOf(subjectById(selected));
    const subs = top ? subsOf(top.id) : [];
    return !subs.length ? '' : `<span class="sub-pick-title">Subasignatura</span>
      <button type="button" data-sid="${top.id}" class="${selected === top.id ? 'active' : ''}">Toda la asignatura</button>
      ${subs.map((c) => `<button type="button" data-sid="${c.id}" class="${selected === c.id ? 'active' : ''}" style="--c:${c.color}">${esc(c.name)}</button>`).join('')}`;
  };
  if (!options.length) {
    openModal(`<div class="modal-head"><h2>Este horario aún no tiene asignaturas</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <p>Para rellenar el horario necesitas al menos una asignatura (con su aula, profesor/a y color).</p>
      <div class="modal-foot"><button class="btn btn-primary" id="go-subj">Crear asignatura</button></div>`, (root) => {
      $('#go-subj', root).onclick = () => { state.ttSel = null; closeModal(); location.hash = 'subjects'; openSubjectModal(null); };
    });
    return;
  }
  const range = (c) => {
    const sl = c.slotIds.map((id) => state.slots.find((s) => s.id === id));
    return `${sl[0].start_time}–${sl[sl.length - 1].end_time}`;
  };
  // Resumen de lo elegido, agrupado por día: «Lunes 9:00–10:00, 11:00–12:00 · Miércoles…»
  const summary = DAY_ORDER.filter((d) => cells.some((c) => c.day === d))
    .map((d) => `${DAY_LONG[d]} ${cells.filter((c) => c.day === d).sort((a, b) => range(a).localeCompare(range(b))).map(range).join(', ')}`)
    .join(' · ');
  const heading = many ? `${cells.length} casillas` : `${DAY_LONG[cells[0].day]} · ${range(cells[0])}`;
  openModal(`
    <form id="slot-form">
      <div class="modal-head"><div class="head-text"><h2>${heading}</h2>${many ? `<small class="hint">${esc(summary)}</small>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      ${selected === undefined ? '<p class="hint" style="margin:-4px 0 12px">Ahora tienen asignaturas distintas. Elige la que quieras poner en todas.</p>' : ''}
      <div class="subject-pick">
        <button type="button" class="none ${selected === null ? 'active' : ''}" data-sid="">— Libre —</button>
        ${options.map((s) => `<button type="button" data-sid="${s.id}" class="${selected != null && topOf(subjectById(selected))?.id === s.id ? 'active' : ''}" style="--c:${s.color}">${esc(s.name)}</button>`).join('')}
      </div>
      <div class="sub-pick" id="sub-pick">${subRow()}</div>
      ${!many && targets.length > 1 ? `<p class="hint" style="margin:-4px 0 12px">Son ${targets.length} horas seguidas. Los cambios se aplican a todas.</p>` : ''}
      <label class="field"><span>${many ? 'Aula para estas clases (opcional)' : 'Aula para esta clase (opcional)'}</span><input type="text" name="room" value="${mixedRooms ? '' : esc(rooms[0] || '')}"></label>
      <div class="error" id="form-error"></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">${many ? 'Aplicar a todas' : 'Guardar'}</button></div>
    </form>`, (root) => {
    const form = $('#slot-form', root);
    const roomInput = form.room;
    let roomTouched = false;
    roomInput.oninput = () => { roomTouched = true; };
    const updatePlaceholder = () => {
      const s = subjectById(selected);
      roomInput.placeholder = mixedRooms && !roomTouched ? 'Vacío: cada clase conserva su aula'
        : effRoom(s) ? `Por defecto: ${effRoom(s)}` : 'Por defecto: aula de la asignatura';
    };
    updatePlaceholder();
    $('.subject-pick', form).onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      selected = b.dataset.sid ? Number(b.dataset.sid) : null;
      $$('.subject-pick button', form).forEach((x) => x.classList.toggle('active', x === b));
      $('#sub-pick', form).innerHTML = subRow();
      updatePlaceholder();
    };
    $('#sub-pick', form).onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      selected = Number(b.dataset.sid);
      $$('#sub-pick button', form).forEach((x) => x.classList.toggle('active', x === b));
      updatePlaceholder();
    };
    $('.subject-pick', form).ondblclick = () => form.requestSubmit();
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (selected === undefined) { $('#form-error', form).textContent = 'Elige una asignatura (o «Libre» para vaciarlas)'; return; }
      try {
        state.schedule = await api('PUT', '/schedule/bulk', {
          cells: targets.map((x) => ({ slot_id: x.slot.id, day: x.day })),
          subject_id: selected,
          room_override: roomInput.value,
          keep_room: mixedRooms && !roomTouched,
        });
        state.ttSel = null;
        closeModal();
        refresh();
        if (many) toast(selected === null ? 'Casillas vaciadas' : `${subjectLabel(subjectById(selected))} en ${cells.length} casillas`);
      } catch (err) {
        $('#form-error', form).textContent = err.message;
      }
    };
  });
}

/** Crear o editar una tarea / examen. */
function openItemModal(item, defaults = {}) {
  const isNew = !item;
  const due = item ? new Date(item.due_at) : null;
  const data = {
    type: item?.type || defaults.type || 'task',
    title: item?.title || '',
    description: item?.description || '',
    subject_id: item?.subject_id ?? null,
    date: due ? dateKey(due) : defaults.date || dateKey(new Date()),
    time: due ? timeOf(due) : '09:00',
    reminder_minutes: item ? item.reminder_minutes : state.user.default_reminder_minutes,
    done: item?.done || false,
    checklist: (item?.checklist || []).map((c) => ({ text: c.text, done: c.done })),
  };
  let timeTouched = !isNew;
  // Pertenece a un horario: el suyo si ya existe; si es nueva, el que está abierto.
  const tt = state.timetables.find((t) => t.id === (item?.timetable_id ?? defaults.timetable_id)) || activeTT();

  openModal(`
    <form id="item-form" novalidate>
      <div class="modal-head">
        <div class="head-text"><h2 id="item-heading"></h2>${state.timetables.length > 1 ? `<small class="hint">${esc(tt.name)}</small>` : ''}</div>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button>
      </div>
      <div class="field"><div class="segmented" id="type-seg">
        <button type="button" data-type="task">${icon('check')}Tarea</button><button type="button" data-type="exam" class="exam">${icon('exam')}Examen</button>
      </div></div>
      <label class="field"><span>Título</span><input type="text" name="title" value="${esc(data.title)}" placeholder="Ej.: Ejercicios del tema 3" required></label>
      <div class="field"><span>Asignatura</span>
        <input type="hidden" name="subject_id" value="${data.subject_id ?? ''}">
        <div class="subject-chips" id="subj-chips"></div>
        <small class="hint" id="subj-name"></small>
      </div>
      <div class="row">
        <label class="field"><span>Fecha</span><input type="date" name="date" value="${data.date}" required></label>
        <label class="field"><span>Hora</span><input type="time" name="time" value="${data.time}" required></label>
      </div>
      <label class="field"><span>Aviso</span>
        <select name="reminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${v === data.reminder_minutes ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${state.user.email_notifications || state.pushDevices ? '' : '<small class="hint">No tienes activado ningún aviso. Actívalos en Ajustes, por correo o con notificaciones.</small>'}
      </label>
      <label class="field"><span>Descripción / notas</span><textarea name="description" placeholder="Temas que entran, páginas, materiales…">${esc(data.description)}</textarea></label>
      <div class="field"><span>Checklist</span>
        <div class="cl-editor" id="cl-list"></div>
        <div class="cl-row"><input type="text" id="cl-new" placeholder="Añadir paso y pulsar Enter"><button type="button" class="btn btn-sm" id="cl-add">Añadir</button></div>
      </div>
      <label class="check-line"><input type="checkbox" name="done" ${data.done ? 'checked' : ''}> Marcar como realizada</label>
      <div class="error" id="form-error"></div>
      <div class="modal-foot">
        ${isNew ? '' : '<button type="button" class="btn btn-danger left" id="del-item">' + icon('trash') + 'Eliminar</button>'}
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn btn-primary">Guardar</button>
      </div>
    </form>`, (root) => {
    const form = $('#item-form', root);
    const setType = (t) => {
      data.type = t;
      $$('#type-seg button', form).forEach((b) => b.classList.toggle('active', b.dataset.type === t));
      $('#item-heading', form).textContent = isNew ? (t === 'exam' ? 'Nuevo examen' : 'Nueva tarea') : t === 'exam' ? 'Editar examen' : 'Editar tarea';
    };
    setType(data.type);
    $('#type-seg', form).onclick = (e) => { const b = e.target.closest('button'); if (b) setType(b.dataset.type); };

    const renderChecklist = () => {
      $('#cl-list', form).innerHTML = data.checklist.map((c, i) => `
        <div class="cl-row"><input type="checkbox" data-i="${i}" ${c.done ? 'checked' : ''}>
          <input type="text" data-i="${i}" value="${esc(c.text)}">
          <button type="button" class="icon-btn" data-rm="${i}" title="Quitar" aria-label="Quitar">${icon('x')}</button></div>`).join('');
    };
    renderChecklist();
    const addStep = () => {
      const input = $('#cl-new', form);
      const text = input.value.trim();
      if (!text) return;
      data.checklist.push({ text, done: false });
      input.value = '';
      renderChecklist();
      input.focus();
    };
    $('#cl-add', form).onclick = addStep;
    $('#cl-new', form).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } };
    $('#cl-list', form).oninput = (e) => {
      const i = Number(e.target.dataset.i);
      if (e.target.type === 'checkbox') data.checklist[i].done = e.target.checked;
      else data.checklist[i].text = e.target.value;
    };
    $('#cl-list', form).onclick = (e) => {
      const b = e.target.closest('[data-rm]');
      if (b) { data.checklist.splice(Number(b.dataset.rm), 1); renderChecklist(); }
    };

    // Si eliges una asignatura que tienes ese día, propone la hora de su clase.
    const suggestTime = () => {
      if (timeTouched || !form.subject_id.value || !form.date.value) return;
      const day = parseKey(form.date.value);
      const chosen = subjectById(Number(form.subject_id.value));
      const classes = classesOnDate(tt, day);
      const cls = classes.find((c) => c.subject.id === chosen.id) || classes.find((c) => topOf(c.subject).id === topOf(chosen).id);
      if (cls) form.time.value = cls.slot.start_time;
    };
    form.time.oninput = () => { timeTouched = true; };
    // Solo se ofrecen las asignaturas de su horario.
    const renderChips = () => {
      const selectedId = form.subject_id.value ? Number(form.subject_id.value) : null;
      const list = ttSubjects(tt.id);
      const current = subjectById(selectedId);
      const top = topOf(current);
      if (top && !list.includes(top)) list.unshift(top);
      const subs = top ? subsOf(top.id) : [];
      $('#subj-chips', form).innerHTML = `
        <button type="button" class="schip none ${selectedId == null ? 'active' : ''}" data-sid="" title="Sin asignatura" aria-label="Sin asignatura">—</button>
        ${list.map((s) => `<button type="button" class="schip ${s.id === top?.id ? 'active' : ''}" data-sid="${s.id}" style="--c:${s.color};--ink:${textOn(s.color)}" title="${esc(s.name)}" aria-label="${esc(s.name)}">${esc(shortName(s))}</button>`).join('')}
        ${subs.length ? `<div class="sub-chips"><span>Subasignatura</span>
          <button type="button" class="schip mini ${selectedId === top.id ? 'active' : ''}" data-sid="${top.id}">General</button>
          ${subs.map((c) => `<button type="button" class="schip mini ${c.id === selectedId ? 'active' : ''}" data-sid="${c.id}" style="--c:${c.color};--ink:${textOn(c.color)}" title="${esc(c.name)}">${esc(c.short_name || c.name)}</button>`).join('')}</div>` : ''}`;
      $('#subj-name', form).textContent = list.length
        ? subjectLabel(current) || 'Sin asignatura'
        : `«${tt.name}» aún no tiene asignaturas. Créalas en la pestaña Asignaturas.`;
    };
    renderChips();
    $('#subj-chips', form).onclick = (e) => {
      const b = e.target.closest('.schip');
      if (!b) return;
      form.subject_id.value = b.dataset.sid;
      renderChips();
      suggestTime();
    };
    form.date.onchange = suggestTime;
    // En el móvil no se abre el teclado solo: desplazaba la ventana y ocultaba su parte de arriba.
    if (!item && !window.matchMedia('(pointer: coarse)').matches) setTimeout(() => form.title.focus(), 0);

    if (!isNew) {
      $('#del-item', form).onclick = async () => {
        if (!confirm(`¿Eliminar «${item.title}»?`)) return;
        if ((await attempt(() => api('DELETE', `/items/${item.id}`), 'Eliminado')) !== undefined) {
          state.items = state.items.filter((i) => i.id !== item.id);
          closeModal();
          refresh();
          if (defaults.returnTo) openDayModal(defaults.returnTo);
        }
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#form-error', form);
      const pending = $('#cl-new', form).value.trim();
      if (pending) data.checklist.push({ text: pending, done: false });
      if (!form.title.value.trim()) { err.textContent = 'Escribe un título'; form.title.focus(); return; }
      if (!form.date.value || !form.time.value) { err.textContent = 'Indica la fecha y la hora'; return; }
      const payload = {
        type: data.type,
        title: form.title.value,
        description: form.description.value,
        subject_id: form.subject_id.value ? Number(form.subject_id.value) : null,
        timetable_id: tt.id,
        due_at: new Date(`${form.date.value}T${form.time.value}`).toISOString(),
        reminder_minutes: form.reminder.value === '' ? null : Number(form.reminder.value),
        done: form.done.checked,
        checklist: data.checklist.filter((c) => c.text.trim()),
      };
      try {
        const saved = isNew ? await api('POST', '/items', payload) : await api('PUT', `/items/${item.id}`, payload);
        upsertItem(saved);
        closeModal();
        renderView();
        // Volver al detalle del día si se abrió desde él.
        if (defaults.returnTo) openDayModal(defaults.returnTo);
        toast(isNew ? (data.type === 'exam' ? 'Examen añadido' : 'Tarea añadida') : 'Cambios guardados');
      } catch (ex) {
        err.textContent = ex.message;
      }
    };
  });
}

/* ============================================================
   Notificaciones push
   ============================================================ */
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function base64UrlToBytes(b64) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Has bloqueado las notificaciones para Horaria.' : 'No se ha dado permiso para mostrar notificaciones.');
  }
  const { publicKey } = await api('GET', '/push/key');
  const reg = await navigator.serviceWorker.ready;
  const key = base64UrlToBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // Si la suscripción se hizo con otra clave del servidor, se renueva.
  const oldKey = sub?.options?.applicationServerKey;
  if (sub && oldKey && new Uint8Array(oldKey).toString() !== key.toString()) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const r = await api('POST', '/push/subscribe', { subscription: sub.toJSON() });
  state.pushDevices = r.push_devices;
}

async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const r = await api('POST', '/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => null);
  await sub.unsubscribe().catch(() => {});
  if (r) state.pushDevices = r.push_devices;
}

/** Al cerrar sesión, este dispositivo deja de recibir las notificaciones de la cuenta. */
async function forgetThisDevice() {
  try {
    const sub = await currentSubscription();
    if (sub) await api('POST', '/push/unsubscribe', { endpoint: sub.endpoint });
  } catch {
    /* sin conexión: el servidor la borrará cuando deje de ser válida */
  }
}

/** Al abrir la app, vuelve a asociar la suscripción de este dispositivo a la cuenta actual. */
async function syncPushSubscription() {
  if (!state.pushAvailable || !pushSupported() || Notification.permission !== 'granted') return;
  try {
    const sub = await currentSubscription();
    if (sub) state.pushDevices = (await api('POST', '/push/subscribe', { subscription: sub.toJSON() })).push_devices;
  } catch {
    /* no es grave: se reintenta la próxima vez */
  }
}

async function renderPushBox() {
  const box = $('#push-box');
  if (!box) return;
  const others = (n) => (n > 0 ? `<p class="hint">Recibes notificaciones en ${plural(n, 'dispositivo', 'dispositivos')}.</p>` : '');
  if (!state.pushAvailable) {
    box.innerHTML = '<p class="hint">Las notificaciones no están disponibles en este servidor.</p>';
    return;
  }
  if (!pushSupported()) {
    box.innerHTML = isIOS() && !isStandalone()
      ? `<div class="status info">${icon('alert')}<div><b>En iPhone, primero instala Horaria.</b><ol>
          <li>Abre esta página en Safari.</li>
          <li>Pulsa el botón Compartir y elige «Añadir a pantalla de inicio».</li>
          <li>Abre Horaria desde el icono nuevo y vuelve a esta pantalla.</li></ol></div></div>${others(state.pushDevices)}`
      : `<p class="hint">Este navegador no admite notificaciones. Prueba con Chrome, Edge, Firefox o Safari actualizados.</p>${others(state.pushDevices)}`;
    return;
  }
  if (Notification.permission === 'denied') {
    box.innerHTML = `<div class="status warn">${icon('alert')}<span>Has bloqueado las notificaciones para Horaria. Permítelas en los ajustes del navegador (o del móvil) y recarga la página.</span></div>${others(state.pushDevices)}`;
    return;
  }
  const sub = Notification.permission === 'granted' ? await currentSubscription() : null;
  if (sub) {
    box.innerHTML = `<div class="push-state on">${icon('check')}<span>Activadas en este dispositivo.</span></div>
      ${state.pushDevices > 1 ? others(state.pushDevices) : ''}
      <div class="push-actions"><button class="btn btn-sm" id="push-test">${icon('bell')}Enviar notificación de prueba</button>
      <button class="btn btn-sm btn-ghost" id="push-off">Desactivar</button></div>`;
  } else {
    box.innerHTML = `<p class="hint" style="margin:0 0 10px">Te avisaremos en este ${isMobile() ? 'móvil' : 'ordenador'} aunque tengas Horaria cerrada.</p>
      <button class="btn btn-primary" id="push-on">${icon('bell')}Activar notificaciones</button>${others(state.pushDevices)}`;
  }
  const busy = (b, fn) => async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (err) {
      toast(err.message, true);
    }
    b.disabled = false;
    renderPushBox();
  };
  const on = $('#push-on', box);
  if (on) on.onclick = busy(on, async () => { await enablePush(); toast('Notificaciones activadas'); });
  const off = $('#push-off', box);
  if (off) off.onclick = busy(off, async () => { await disablePush(); toast('Notificaciones desactivadas en este dispositivo'); });
  const test = $('#push-test', box);
  if (test) test.onclick = busy(test, async () => { await api('POST', '/push/test'); toast('Notificación enviada'); });
}

/* ============================================================
   Arranque
   ============================================================ */
async function start() {
  await loadAll();
  renderShell();
  renderView();
  syncPushSubscription();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Cuando terminan de cargar las fuentes, se reajustan los nombres del horario.
document.fonts?.ready.then(() => { if (state.view === 'week') fitTimetable(); });

(async () => {
  try {
    await start();
  } catch {
    renderAuth('login');
  }
  // Actualiza la vista (hora actual, vencidas…) cada minuto.
  setInterval(() => { if (state.user && !$('#modal-root').innerHTML && state.view !== 'settings') renderView(); }, 60000);
})();
