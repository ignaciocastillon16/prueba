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
  [null, 'Sin aviso por correo'], [0, 'A la hora exacta'], [15, '15 minutos antes'], [30, '30 minutos antes'],
  [60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes'], [720, '12 horas antes'], [1440, '1 día antes'],
  [2880, '2 días antes'], [4320, '3 días antes'], [10080, '1 semana antes'],
];
const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#78350f'];

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
  view: 'month',
  cursor: startOfMonth(new Date()),
  selectedDay: dateKey(new Date()),
  showClasses: pref('showClasses', true),
  filter: { type: 'all', subject: '', showDone: pref('showDone', false) },
};
const subjectById = (id) => state.subjects.find((s) => s.id === id);
const itemById = (id) => state.items.find((i) => i.id === id);
const visibleDays = () => DAY_ORDER.filter((d) => state.user.visible_days.includes(d));
function classesOn(day) {
  const slotIndex = new Map(state.slots.map((s, i) => [s.id, i]));
  return state.schedule
    .filter((e) => e.day === day && slotIndex.has(e.slot_id) && subjectById(e.subject_id))
    .sort((a, b) => slotIndex.get(a.slot_id) - slotIndex.get(b.slot_id))
    .map((e) => ({ entry: e, slot: state.slots[slotIndex.get(e.slot_id)], subject: subjectById(e.subject_id) }));
}

async function loadAll() {
  const [boot, items] = await Promise.all([api('GET', '/bootstrap'), api('GET', '/items')]);
  state.user = boot.user;
  state.mailConfigured = boot.mail_configured;
  state.subjects = boot.subjects;
  state.slots = boot.slots;
  state.schedule = boot.schedule;
  state.items = items;
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
    <form class="auth" id="auth-form" novalidate>
      <h1>📚 Mi Horario</h1>
      <p class="sub">${isLogin ? 'Inicia sesión para ver tu horario.' : 'Crea tu cuenta gratuita.'}</p>
      ${isLogin ? '' : '<label class="field"><span>Nombre</span><input type="text" name="name" autocomplete="name" required maxlength="80"></label>'}
      <label class="field"><span>Correo electrónico</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8">
        ${isLogin ? '' : '<small class="hint">Mínimo 8 caracteres.</small>'}</label>
      <div class="error" id="auth-error"></div>
      <button class="btn btn-primary" type="submit">${isLogin ? 'Entrar' : 'Crear cuenta'}</button>
      <div class="switch">${isLogin ? '¿No tienes cuenta? <a data-mode="register">Regístrate</a>' : '¿Ya tienes cuenta? <a data-mode="login">Inicia sesión</a>'}</div>
    </form>`;
  $('.switch a').onclick = (e) => renderAuth(e.target.dataset.mode);
  $('#auth-form input').focus();
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
const VIEWS = [
  ['month', '📅', 'Mes', 'Mes'],
  ['week', '🗓', 'Horario', 'Horario'],
  ['items', '✅', 'Tareas y exámenes', 'Tareas'],
  ['subjects', '📘', 'Asignaturas', 'Materias'],
  ['settings', '⚙️', 'Ajustes', 'Ajustes'],
];

function renderShell() {
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="brand">📚 Mi Horario</div>
      <nav class="tabs">${VIEWS.map(([id, icon, label, short]) => `<button data-view="${id}"><span class="ic">${icon}</span><span class="long">${label}</span><span class="short">${short}</span></button>`).join('')}</nav>
      <div class="userbox"><span class="name">${esc(state.user.name)}</span><button class="btn btn-sm" id="logout">Salir</button></div>
    </header>
    <main id="view"></main>`;
  $('.tabs').onclick = (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) location.hash = b.dataset.view;
  };
  $('#logout').onclick = async () => {
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
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const el = $('#view');
  const scrollEl = $('.scroll', el);
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
  el.innerHTML = { month: monthView, week: weekView, items: itemsView, subjects: subjectsView, settings: settingsView }[view]();
  if (view === 'settings') bindSettings(el);
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
      if (item) { upsertItem(item); refresh(); if (item.done) toast('¡Hecho! ✅'); } else t.checked = !t.checked;
    } else if (t.dataset.check) {
      const item = await attempt(() => api('PATCH', `/checklist/${t.dataset.check}`, { done: t.checked }));
      if (item) {
        upsertItem(item);
        refresh();
        if (!item.done && item.checklist.length && item.checklist.every((c) => c.done)) toast('Has completado toda la lista. Puedes marcarla como hecha.');
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
    const cell = t.closest('.day-cell');
    if (cell) return isMobile() ? selectDay(cell.dataset.date) : openDayModal(cell.dataset.date);
    const tt = t.closest('.tt-cell');
    if (tt) return openSlotModal(Number(tt.dataset.slot), Number(tt.dataset.day));
  });
}

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
  editSubject: (d) => openSubjectModal(subjectById(Number(d.id))),
  deleteSubject: async (d) => {
    const s = subjectById(Number(d.id));
    if (!confirm(`¿Eliminar la asignatura «${s.name}»? Se quitará del horario y sus tareas quedarán sin asignatura.`)) return;
    if ((await attempt(() => api('DELETE', `/subjects/${s.id}`), 'Asignatura eliminada')) !== undefined) {
      await loadAll();
      renderView();
    }
  },
  goto: (d) => { location.hash = d.view; },
};

/* ============================================================
   Vista mensual
   ============================================================ */
function itemChip(item) {
  const d = new Date(item.due_at);
  const s = subjectById(item.subject_id);
  const doneCount = item.checklist.filter((c) => c.done).length;
  return `<div class="chip-item ${item.type} ${item.done ? 'done' : ''}" data-edit="${item.id}" style="--c:${s ? s.color : 'var(--muted)'}"
      title="${esc(`${item.type === 'exam' ? 'Examen' : 'Tarea'}: ${item.title}${s ? ` (${s.name})` : ''} · ${timeOf(d)}`)}">
    <input type="checkbox" data-toggle="${item.id}" ${item.done ? 'checked' : ''} aria-label="Marcar como hecha">
    <span class="t">${item.type === 'exam' ? '📝 ' : ''}${timeOf(d)} ${esc(item.title)}</span>
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
  const days = visibleDays();
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const weeks = [];
  for (let d = new Date(y, m, 1 - ((first.getDay() + 6) % 7)); d <= last; ) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const vis = week.filter((x) => days.includes(x.getDay()));
    if (vis.some((x) => x.getMonth() === m)) weeks.push(vis);
  }
  const byDay = new Map();
  for (const it of state.items) {
    const k = dateKey(new Date(it.due_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(it);
  }
  const todayKey = dateKey(new Date());
  const classCache = new Map(days.map((d) => [d, classesOn(d)]));
  const title = cap(state.cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
  const monthPrefix = `${y}-${pad(m + 1)}`;
  const monthItems = state.items.filter((i) => dateKey(new Date(i.due_at)).startsWith(monthPrefix));
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
      const groups = state.showClasses ? groupClasses(classCache.get(d.getDay())) : [];
      return `<div class="day-cell ${d.getMonth() !== m ? 'other' : ''} ${k === todayKey ? 'today' : ''} ${k === state.selectedDay ? 'selected' : ''}" data-date="${k}">
        <span class="day-num">${d.getDate()}</span>
        ${groups.length ? `<div class="cbar">${groups.map((g) => `<i style="background:${g.subject.color};flex:${g.count}"></i>`).join('')}</div>` : ''}
        <div class="dots">${dayItems.slice(0, 4).map((i) => `<i class="${i.type} ${i.done ? 'done' : ''}" style="--c:${subjectById(i.subject_id)?.color || 'var(--muted)'}"></i>`).join('')}${dayItems.length > 4 ? `<b>+${dayItems.length - 4}</b>` : ''}</div>
      </div>`;
    }
    const classes = state.showClasses ? classCache.get(d.getDay()) : [];
    return `<div class="day-cell ${d.getMonth() !== m ? 'other' : ''} ${k === todayKey ? 'today' : ''}" data-date="${k}">
      <div class="day-head"><span class="day-num">${d.getDate()}</span><button class="icon-btn add" data-action="newItem" data-type="task" data-date="${k}" title="Añadir tarea">+</button></div>
      ${classes.length ? `<div class="classes">${groupClasses(classes).map((g) => `<span class="cls" style="background:${g.subject.color};color:${textOn(g.subject.color)}" title="${esc(`${g.start}–${g.end} ${g.subject.name}`)}">${esc(shortName(g.subject))}${g.count > 1 ? `×${g.count}` : ''}</span>`).join('')}</div>` : ''}
      <div class="cell-items">${(byDay.get(k) || []).map(itemChip).join('')}</div>
    </div>`;
  });

  return `
    <div class="toolbar month-toolbar">
      <button class="btn" data-action="prev" title="Mes anterior" aria-label="Mes anterior">‹</button>
      <h2>${esc(title)}</h2>
      <button class="btn" data-action="next" title="Mes siguiente" aria-label="Mes siguiente">›</button>
      <button class="btn" data-action="today">Hoy</button>
      <span class="legend hide-mobile"><span>📝 ${pendingExams} examen(es)</span><span>✅ ${pendingTasks} tarea(s) pendientes</span></span>
      <span class="spacer"></span>
      <label class="toggle hide-mobile"><input type="checkbox" id="toggle-classes" ${state.showClasses ? 'checked' : ''}> Clases</label>
      <button class="btn btn-primary hide-mobile" data-action="newItem" data-type="task">+ Tarea</button>
      <button class="btn btn-exam hide-mobile" data-action="newItem" data-type="exam">+ Examen</button>
    </div>
    ${mobile ? '<div class="scroll month-scroll">' : ''}
    <div class="month-grid ${mobile ? 'compact' : ''}" style="grid-template-columns:repeat(${days.length},minmax(0,1fr));grid-template-rows:auto repeat(${weeks.length},minmax(0,1fr))">
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
function weekView() {
  const days = visibleDays();
  if (!state.slots.length) {
    return `<div class="empty card">No tienes tramos horarios. <button class="btn btn-primary" data-action="goto" data-view="settings">Configurar tramos</button></div>`;
  }
  const now = new Date();
  const nowTime = timeOf(now);
  const todayDow = now.getDay();
  const rows = state.slots.map((s) => `minmax(0,${s.is_break ? 0.5 : 1}fr)`).join(' ');
  let html = `<div></div>${days.map((d) => `<div class="tt-head ${d === todayDow ? 'today' : ''}"><span class="long">${DAY_LONG[d]}</span><span class="short">${DAY_SHORT[d]}</span></div>`).join('')}`;
  for (const slot of state.slots) {
    html += `<div class="tt-time"><b>${slot.start_time}</b><span>${slot.end_time}</span>${slot.label && !slot.is_break ? `<span class="hide-mobile">${esc(slot.label)}</span>` : ''}</div>`;
    if (slot.is_break) {
      html += `<div class="tt-break" style="grid-column:2 / span ${days.length}">☕ ${esc(slot.label || 'Descanso')}</div>`;
      continue;
    }
    for (const d of days) {
      const entry = state.schedule.find((e) => e.slot_id === slot.id && e.day === d);
      const s = entry && subjectById(entry.subject_id);
      const isNow = d === todayDow && nowTime >= slot.start_time && nowTime < slot.end_time;
      if (s) {
        const room = entry.room_override || s.room;
        html += `<div class="tt-cell filled ${isNow ? 'now' : ''}" data-slot="${slot.id}" data-day="${d}" style="background:${s.color};color:${textOn(s.color)}" title="${esc(`${s.name}${room ? ` · Aula ${room}` : ''}${s.teacher ? ` · ${s.teacher}` : ''}`)}">
          <div class="n"><span class="long">${esc(s.name)}</span><span class="short">${esc(shortName(s))}</span></div>
          ${room ? `<div class="d">📍 ${esc(room)}</div>` : ''}
          ${s.teacher ? `<div class="d">👤 ${esc(s.teacher)}</div>` : ''}
        </div>`;
      } else {
        html += `<div class="tt-cell ${isNow ? 'now' : ''}" data-slot="${slot.id}" data-day="${d}"><div class="plus">+</div></div>`;
      }
    }
  }
  return `
    <div class="toolbar">
      <h2>Horario semanal</h2>
      <span class="hint hide-mobile">Pulsa una celda para asignar una asignatura.</span>
      <span class="spacer"></span>
      <button class="btn" data-action="goto" data-view="settings" title="Tramos y días">⚙️<span class="long"> Tramos y días</span></button>
      <button class="btn" data-action="goto" data-view="subjects" title="Asignaturas">📘<span class="long"> Asignaturas</span></button>
    </div>
    <div class="tt-grid" style="grid-template-columns:${isMobile() ? '40px' : 'minmax(48px,80px)'} repeat(${days.length},minmax(0,1fr));grid-template-rows:auto ${rows}">${html}</div>`;
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
        ${s ? `<span><span class="dot" style="--c:${s.color}"></span> ${esc(s.name)}</span>` : ''}
        <span>🗓 ${esc(fmtDateTime(d))}</span>
        <span class="${overdue ? 'overdue' : ''}">${overdue ? '⚠️ Vencida ' : ''}${esc(relative(d))}</span>
        ${item.reminder_minutes !== null ? `<span title="Aviso por correo: ${esc(rem ? rem[1] : `${item.reminder_minutes} min antes`)}">${item.reminder_sent ? '📨' : '🔔'}</span>` : ''}
      </div>
      <h3 data-edit="${item.id}">${esc(item.title)}</h3>
      ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ''}
      ${item.checklist.length ? `
        <ul class="checklist">${item.checklist.map((c) => `<li><label class="${c.done ? 'done' : ''}"><input type="checkbox" data-check="${c.id}" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span></label></li>`).join('')}</ul>
        <div class="progress" title="${done}/${item.checklist.length}"><div style="width:${Math.round((done / item.checklist.length) * 100)}%"></div></div>` : ''}
    </div>
    <button class="icon-btn" data-edit="${item.id}" title="Editar">✏️</button>
  </article>`;
}

function itemsView() {
  const f = state.filter;
  const list = state.items.filter((i) => (f.type === 'all' || i.type === f.type) && (!f.subject || i.subject_id === Number(f.subject)));
  const now = new Date();
  const todayKey = dateKey(now);
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  const pending = list.filter((i) => !i.done);
  const groups = [
    ['⚠️ Vencidas', pending.filter((i) => new Date(i.due_at) < now), 'danger'],
    ['Hoy', pending.filter((i) => new Date(i.due_at) >= now && dateKey(new Date(i.due_at)) === todayKey)],
    ['Próximos 7 días', pending.filter((i) => dateKey(new Date(i.due_at)) > todayKey && new Date(i.due_at) < in7)],
    ['Más adelante', pending.filter((i) => new Date(i.due_at) >= in7)],
  ];
  if (f.showDone) groups.push(['Completadas', list.filter((i) => i.done).reverse()]);
  const body = groups
    .filter(([, items]) => items.length)
    .map(([title, items, cls]) => `<div class="group-title ${cls || ''}">${title} <span>(${items.length})</span></div>${items.map(itemCard).join('')}`)
    .join('');
  return `
    <div class="toolbar items-toolbar">
      <div class="segmented" id="type-filter">
        ${[['all', 'Todo'], ['task', 'Tareas'], ['exam', 'Exámenes']].map(([v, l]) => `<button data-type="${v}" class="${f.type === v ? 'active' : ''}">${l}</button>`).join('')}
      </div>
      <select id="subject-filter" style="width:auto">
        <option value="">Todas las asignaturas</option>
        ${state.subjects.map((s) => `<option value="${s.id}" ${String(s.id) === f.subject ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
      <label class="toggle"><input type="checkbox" id="show-done" ${f.showDone ? 'checked' : ''}> <span class="long">Mostrar completadas</span><span class="short">Hechas</span></label>
      <span class="spacer"></span>
      <button class="btn btn-primary hide-mobile" data-action="newItem" data-type="task">+ Tarea</button>
      <button class="btn btn-exam hide-mobile" data-action="newItem" data-type="exam">+ Examen</button>
    </div>
    <div class="scroll">${body || `<div class="empty">🎉 No hay nada pendiente${f.type !== 'all' || f.subject ? ' con estos filtros' : ''}.</div>`}</div>
    <button class="fab show-mobile" data-action="newItem" data-type="task" aria-label="Añadir tarea o examen">+</button>`;
}
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
  const hours = (id) => state.schedule.filter((e) => e.subject_id === id && state.slots.some((s) => s.id === e.slot_id)).length;
  return `
    <div class="toolbar">
      <h2>Asignaturas</h2>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-action="newSubject">+ <span class="long">Nueva asignatura</span><span class="short">Nueva</span></button>
    </div>
    <div class="scroll">
      ${state.subjects.length ? `<div class="subjects-grid">${state.subjects.map((s) => `
        <div class="card subject-card" style="--c:${s.color}">
          <h3><span class="dot" style="--c:${s.color}"></span>${esc(s.name)} <span class="hint">${esc(shortName(s))}</span></h3>
          <div class="info">📍 Aula: ${esc(s.room || '—')}</div>
          <div class="info">👤 Profesor/a: ${esc(s.teacher || '—')}</div>
          <div class="info">🕑 ${hours(s.id)} clase(s) por semana</div>
          <div class="actions">
            <button class="btn btn-sm" data-action="editSubject" data-id="${s.id}">✏️ Editar</button>
            <button class="btn btn-sm btn-danger" data-action="deleteSubject" data-id="${s.id}">🗑 Eliminar</button>
          </div>
        </div>`).join('')}</div>`
      : '<div class="empty">Aún no tienes asignaturas. Crea la primera para empezar a montar tu horario.</div>'}
    </div>`;
}

function openSubjectModal(subject) {
  const s = subject || { name: '', short_name: '', color: PALETTE[(state.subjects.length * 5) % PALETTE.length], room: '', teacher: '' };
  openModal(`
    <form id="subject-form">
      <div class="modal-head"><h2>${subject ? 'Editar asignatura' : 'Nueva asignatura'}</h2><button type="button" class="icon-btn" data-close>✕</button></div>
      <div class="row">
        <label class="field" style="flex:3"><span>Nombre</span><input type="text" name="name" value="${esc(s.name)}" required maxlength="60" placeholder="Matemáticas"></label>
        <label class="field" style="flex:1"><span>Abreviatura</span><input type="text" name="short_name" value="${esc(s.short_name)}" maxlength="6" placeholder="MAT"></label>
      </div>
      <div class="row">
        <label class="field"><span>Aula</span><input type="text" name="room" value="${esc(s.room)}" maxlength="60" placeholder="B-12"></label>
        <label class="field"><span>Profesor/a</span><input type="text" name="teacher" value="${esc(s.teacher)}" maxlength="80" placeholder="Ana García"></label>
      </div>
      <div class="field"><span>Color</span>
        <div class="swatches">
          ${PALETTE.map((c) => `<button type="button" class="swatch ${c === s.color ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
          <input type="color" name="color" value="${esc(s.color)}" title="Color personalizado">
        </div>
      </div>
      <div class="error" id="form-error"></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
    </form>`, (root) => {
    const form = $('#subject-form', root);
    $('input[name=name]', form).focus();
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
        const saved = subject ? await api('PUT', `/subjects/${subject.id}`, data) : await api('POST', '/subjects', data);
        const i = state.subjects.findIndex((x) => x.id === saved.id);
        if (i >= 0) state.subjects[i] = saved; else state.subjects.push(saved);
        state.subjects.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        closeModal();
        refresh();
        toast('Asignatura guardada');
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
    <section class="card">
      <h2>Días de la semana</h2>
      <p class="hint">Elige qué días aparecen en el calendario mensual y en el horario.</p>
      <div class="days-pick">${DAY_ORDER.map((d) => `<label class="${u.visible_days.includes(d) ? 'on' : ''}"><input type="checkbox" data-day="${d}" ${u.visible_days.includes(d) ? 'checked' : ''}> ${DAY_LONG[d]}</label>`).join('')}</div>
    </section>

    <section class="card">
      <h2>Tramos horarios</h2>
      <p class="hint">Define las horas de clase y los descansos. Los cambios se guardan automáticamente.</p>
      <div id="slots">${state.slots.map((s) => `
        <div class="slot-row" data-slot="${s.id}">
          <input type="time" name="start_time" value="${s.start_time}" aria-label="Inicio">
          <input type="time" name="end_time" value="${s.end_time}" aria-label="Fin">
          <input type="text" name="label" value="${esc(s.label)}" placeholder="Etiqueta (opcional)" maxlength="40">
          <label class="brk"><input type="checkbox" name="is_break" ${s.is_break ? 'checked' : ''}> Descanso</label>
          <button class="icon-btn" data-del-slot="${s.id}" title="Eliminar tramo">🗑</button>
        </div>`).join('') || '<p class="hint">No hay tramos.</p>'}</div>
      <button class="btn" id="add-slot">+ Añadir tramo</button>
    </section>

    <section class="card">
      <h2>Avisos por correo</h2>
      <p class="hint">Los avisos se envían a <b>${esc(u.email)}</b>.</p>
      ${state.mailConfigured ? '' : '<div class="status warn">⚠️ El servidor todavía no tiene configurado el envío de correo (SMTP). Los avisos se registrarán en la consola del servidor hasta que se configure.</div>'}
      <label class="check-line"><input type="checkbox" id="s-notify" ${u.email_notifications ? 'checked' : ''}> Recibir recordatorios de tareas y exámenes</label>
      <label class="field"><span>Aviso por defecto para nuevas tareas y exámenes</span>
        <select id="s-default-rem">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${v === u.default_reminder_minutes ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check-line"><input type="checkbox" id="s-digest" ${u.daily_digest ? 'checked' : ''}> Enviarme un resumen diario con lo pendiente de los próximos 7 días</label>
      <div class="row">
        <label class="field"><span>Hora del resumen</span>
          <select id="s-digest-hour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === u.digest_hour ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
        <label class="field"><span>Zona horaria</span><input type="text" id="s-tz" value="${esc(u.timezone)}" list="tz-list"></label>
      </div>
      <datalist id="tz-list">${(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).map((z) => `<option value="${z}">`).join('')}</datalist>
      <button class="btn" id="test-email">📨 Enviar correo de prueba</button>
    </section>

    <section class="card">
      <h2>Cuenta</h2>
      <label class="field"><span>Nombre</span><input type="text" id="s-name" value="${esc(u.name)}" maxlength="80"></label>
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
    if (!(await saveSettings({ visible_days: days }))) renderView();
    else $$('.days-pick label', root).forEach((l) => l.classList.toggle('on', $('input', l).checked));
  };
  $('#slots', root).onchange = async (e) => {
    const row = e.target.closest('.slot-row');
    if (!row) return;
    const data = {
      start_time: $('[name=start_time]', row).value,
      end_time: $('[name=end_time]', row).value,
      label: $('[name=label]', row).value,
      is_break: $('[name=is_break]', row).checked,
    };
    const slots = await attempt(() => api('PUT', `/slots/${row.dataset.slot}`, data), 'Tramo guardado');
    if (slots) state.slots = slots;
    renderView();
  };
  $('#slots', root).onclick = async (e) => {
    const b = e.target.closest('[data-del-slot]');
    if (!b || !confirm('¿Eliminar este tramo? Se quitarán las clases asignadas a él.')) return;
    const slots = await attempt(() => api('DELETE', `/slots/${b.dataset.delSlot}`), 'Tramo eliminado');
    if (slots) { state.slots = slots; state.schedule = await api('GET', '/schedule'); renderView(); }
  };
  $('#add-slot', root).onclick = async () => {
    const last = state.slots[state.slots.length - 1];
    let start = last ? last.end_time : '08:00';
    const [h, m] = start.split(':').map(Number);
    let endMin = Math.min(h * 60 + m + 55, 23 * 60 + 59);
    if (endMin <= h * 60 + m) start = '22:00', endMin = 22 * 60 + 55;
    const slots = await attempt(() => api('POST', '/slots', { start_time: start, end_time: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`, label: '' }), 'Tramo añadido');
    if (slots) { state.slots = slots; renderView(); }
  };
  $('#s-notify', root).onchange = (e) => saveSettings({ email_notifications: e.target.checked });
  $('#s-default-rem', root).onchange = (e) => saveSettings({ default_reminder_minutes: e.target.value === '' ? null : Number(e.target.value) });
  $('#s-digest', root).onchange = (e) => saveSettings({ daily_digest: e.target.checked });
  $('#s-digest-hour', root).onchange = (e) => saveSettings({ digest_hour: Number(e.target.value) });
  $('#s-tz', root).onchange = async (e) => { if (!(await saveSettings({ timezone: e.target.value.trim() }))) e.target.value = state.user.timezone; };
  $('#s-name', root).onchange = async (e) => {
    if (await saveSettings({ name: e.target.value })) $('.userbox .name').textContent = state.user.name;
  };
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
  onMount?.($('.modal', root));
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  modalRefresh = null;
  openDayKey = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal(); });

/** Detalle de un día: clases + tareas/exámenes. */
function dayDetail(key, inModal) {
    const date = parseKey(key);
    const classes = classesOn(date.getDay());
    const items = state.items.filter((i) => dateKey(new Date(i.due_at)) === key);
    return `
      <div class="modal-head"><h2>${esc(cap(fmtLongDate(date)))}</h2>${inModal ? '<button class="icon-btn" data-close>✕</button>' : ''}</div>
      <div class="group-title" style="margin-top:0">Clases</div>
      ${classes.length ? `<div class="day-classes">${classes.map(({ slot, subject, entry }) => `
        <div class="day-class" style="--c:${subject.color}">
          <span class="time">${slot.start_time} – ${slot.end_time}</span>
          <div><b>${esc(subject.name)}</b><div class="info">${[entry.room_override || subject.room ? `📍 ${esc(entry.room_override || subject.room)}` : '', subject.teacher ? `👤 ${esc(subject.teacher)}` : ''].filter(Boolean).join(' · ')}</div></div>
        </div>`).join('')}</div>` : `<p class="hint">${state.user.visible_days.includes(date.getDay()) ? 'No hay clases este día.' : 'Este día no está en tu semana escolar.'}</p>`}
      <div class="group-title">Tareas y exámenes</div>
      ${items.map(itemCard).join('') || '<p class="hint">Nada para este día.</p>'}
      <div class="modal-foot">
        <button class="btn btn-primary" data-action="newItem" data-type="task" data-date="${key}">+ Tarea</button>
        <button class="btn btn-exam" data-action="newItem" data-type="exam" data-date="${key}">+ Examen</button>
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
function openSlotModal(slotId, day) {
  const slot = state.slots.find((s) => s.id === slotId);
  const entry = state.schedule.find((e) => e.slot_id === slotId && e.day === day);
  let selected = entry ? entry.subject_id : null;
  if (!state.subjects.length) {
    openModal(`<div class="modal-head"><h2>Primero crea tus asignaturas</h2><button class="icon-btn" data-close>✕</button></div>
      <p>Para rellenar el horario necesitas al menos una asignatura (con su aula, profesor/a y color).</p>
      <div class="modal-foot"><button class="btn btn-primary" id="go-subj">Crear asignatura</button></div>`, (root) => {
      $('#go-subj', root).onclick = () => { closeModal(); location.hash = 'subjects'; openSubjectModal(null); };
    });
    return;
  }
  openModal(`
    <form id="slot-form">
      <div class="modal-head"><h2>${DAY_LONG[day]} · ${slot.start_time}–${slot.end_time}</h2><button type="button" class="icon-btn" data-close>✕</button></div>
      <div class="subject-pick">
        <button type="button" class="none ${selected === null ? 'active' : ''}" data-sid="">— Libre —</button>
        ${state.subjects.map((s) => `<button type="button" data-sid="${s.id}" class="${selected === s.id ? 'active' : ''}" style="background:${s.color};color:${textOn(s.color)}">${esc(s.name)}</button>`).join('')}
      </div>
      <label class="field"><span>Aula para esta clase (opcional)</span><input type="text" name="room" maxlength="60" value="${esc(entry?.room_override || '')}" placeholder="Por defecto: aula de la asignatura"></label>
      <div class="error" id="form-error"></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
    </form>`, (root) => {
    const form = $('#slot-form', root);
    const roomInput = form.room;
    const updatePlaceholder = () => {
      const s = subjectById(selected);
      roomInput.placeholder = s?.room ? `Por defecto: ${s.room}` : 'Por defecto: aula de la asignatura';
    };
    updatePlaceholder();
    $('.subject-pick', form).onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      selected = b.dataset.sid ? Number(b.dataset.sid) : null;
      $$('.subject-pick button', form).forEach((x) => x.classList.toggle('active', x === b));
      updatePlaceholder();
    };
    $('.subject-pick', form).ondblclick = () => form.requestSubmit();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        state.schedule = await api('PUT', '/schedule', { slot_id: slotId, day, subject_id: selected, room_override: roomInput.value });
        closeModal();
        refresh();
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

  openModal(`
    <form id="item-form" novalidate>
      <div class="modal-head">
        <h2 id="item-heading"></h2>
        <button type="button" class="icon-btn" data-close>✕</button>
      </div>
      <div class="field"><div class="segmented" id="type-seg">
        <button type="button" data-type="task">✅ Tarea</button><button type="button" data-type="exam" class="exam">📝 Examen</button>
      </div></div>
      <label class="field"><span>Título</span><input type="text" name="title" maxlength="150" value="${esc(data.title)}" placeholder="Ej.: Ejercicios del tema 3" required></label>
      <label class="field"><span>Asignatura</span>
        <select name="subject_id"><option value="">Sin asignatura</option>
          ${state.subjects.map((s) => `<option value="${s.id}" ${s.id === data.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select></label>
      <div class="row">
        <label class="field"><span>Fecha</span><input type="date" name="date" value="${data.date}" required></label>
        <label class="field"><span>Hora</span><input type="time" name="time" value="${data.time}" required></label>
      </div>
      <label class="field"><span>Aviso por correo</span>
        <select name="reminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${v === data.reminder_minutes ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${state.user.email_notifications ? '' : '<small class="hint">Tienes los avisos por correo desactivados en Ajustes.</small>'}
      </label>
      <label class="field"><span>Descripción / notas</span><textarea name="description" maxlength="5000" placeholder="Temas que entran, páginas, materiales…">${esc(data.description)}</textarea></label>
      <div class="field"><span>Lista de comprobación</span>
        <div class="cl-editor" id="cl-list"></div>
        <div class="cl-row"><input type="text" id="cl-new" maxlength="200" placeholder="Añadir paso y pulsar Enter"><button type="button" class="btn btn-sm" id="cl-add">Añadir</button></div>
      </div>
      <label class="check-line"><input type="checkbox" name="done" ${data.done ? 'checked' : ''}> Marcar como realizada</label>
      <div class="error" id="form-error"></div>
      <div class="modal-foot">
        ${isNew ? '' : '<button type="button" class="btn btn-danger left" id="del-item">🗑 Eliminar</button>'}
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
          <input type="text" data-i="${i}" value="${esc(c.text)}" maxlength="200">
          <button type="button" class="icon-btn" data-rm="${i}" title="Quitar">✕</button></div>`).join('');
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
      const cls = classesOn(parseKey(form.date.value).getDay()).find((c) => c.subject.id === Number(form.subject_id.value));
      if (cls) form.time.value = cls.slot.start_time;
    };
    form.time.oninput = () => { timeTouched = true; };
    form.subject_id.onchange = suggestTime;
    form.date.onchange = suggestTime;
    if (!item) setTimeout(() => form.title.focus(), 0);

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
   Arranque
   ============================================================ */
async function start() {
  await loadAll();
  renderShell();
  renderView();
}

(async () => {
  try {
    await start();
  } catch {
    renderAuth('login');
  }
  // Actualiza la vista (hora actual, vencidas…) cada minuto.
  setInterval(() => { if (state.user && !$('#modal-root').innerHTML && state.view !== 'settings') renderView(); }, 60000);
})();
