import { subjectLabel } from './items.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const C = { ink: '#1f2b30', muted: '#6c7478', border: '#e4dfd4', bg: '#f6f4ef', accent: '#2c5f6f', warm: '#d9784c', exam: '#b9432c' };
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export function formatDate(iso, timeZone) {
  return new Intl.DateTimeFormat('es-ES', { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
}

export function relativeTime(iso, now = new Date()) {
  const mins = Math.round((Date.parse(iso) - now.getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

const typeLabel = (t) => (t === 'exam' ? 'Examen' : 'Tarea');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function layout(title, bodyHtml, appUrl) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:${C.bg};font-family:${FONT};color:${C.ink}">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px 4px"><tr>
    <td style="width:26px;height:26px;background:${C.accent};border-radius:7px;color:#fff;font:700 14px/26px ${FONT};text-align:center">H</td>
    <td style="padding-left:9px;font:600 19px ${SERIF};color:${C.ink}">Horaria</td>
  </tr></table>
  <div style="background:#ffffff;border-radius:14px;padding:26px 24px;border:1px solid ${C.border}">
    <h1 style="font:600 21px/1.3 ${SERIF};margin:0 0 16px;color:${C.ink}">${esc(title)}</h1>
    ${bodyHtml}
    ${appUrl ? `<p style="margin:26px 0 0"><a href="${esc(appUrl)}" style="background:${C.accent};color:#ffffff;padding:11px 18px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px">Abrir Horaria</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:${C.muted};text-align:center;margin-top:16px">Recibes este correo porque tienes los avisos activados en Horaria. Puedes cambiarlos en Ajustes.</p>
</div></body></html>`;
}

function itemBlock(item, timeZone) {
  const color = item.subject_color || C.muted;
  const checklist = (item.checklist || [])
    .map((c) => `<li style="list-style:none;margin:3px 0;color:${c.done ? C.muted : C.ink}">${c.done ? '&#9745;' : '&#9744;'}&nbsp; ${c.done ? `<s>${esc(c.text)}</s>` : esc(c.text)}</li>`)
    .join('');
  const place = [item.room && `Aula ${esc(item.room)}`, item.teacher && esc(item.teacher)].filter(Boolean).join(' · ');
  return `<div style="border-left:4px solid ${esc(color)};background:${C.bg};border-radius:8px;padding:13px 15px;margin:10px 0">
  <div style="font-size:12px;font-weight:700;color:${item.type === 'exam' ? C.exam : C.accent}">${typeLabel(item.type)}${item.subject_name ? ` · ${esc(subjectLabel(item))}` : ''}</div>
  <div style="font-size:16px;font-weight:600;margin:3px 0">${esc(item.title)}</div>
  <div style="font-size:14px;color:${C.ink}">${esc(formatDate(item.due_at, timeZone))}</div>
  ${place ? `<div style="font-size:13px;color:${C.muted};margin-top:2px">${place}</div>` : ''}
  ${item.description ? `<p style="font-size:14px;white-space:pre-wrap;margin:8px 0 0;color:${C.ink}">${esc(item.description)}</p>` : ''}
  ${checklist ? `<ul style="padding:0;margin:9px 0 0;font-size:14px">${checklist}</ul>` : ''}
</div>`;
}

function itemText(item, timeZone) {
  const lines = [
    `${typeLabel(item.type)}${item.subject_name ? ` (${subjectLabel(item)})` : ''}: ${item.title}`,
    `Fecha: ${formatDate(item.due_at, timeZone)}`,
  ];
  if (item.room) lines.push(`Aula: ${item.room}`);
  if (item.teacher) lines.push(`Profesor/a: ${item.teacher}`);
  if (item.description) lines.push(item.description);
  for (const c of item.checklist || []) lines.push(`  [${c.done ? 'x' : ' '}] ${c.text}`);
  return lines.join('\n');
}

export function reminderEmail(item, user, appUrl, now = new Date()) {
  const when = relativeTime(item.due_at, now);
  const subject = `Recordatorio: ${item.title} (${when})`;
  const heading = item.type === 'exam' ? `Tienes un examen ${when}` : `Tienes una entrega ${when}`;
  const html = layout(heading, `<p style="font-size:15px;margin:0 0 6px">Hola, ${esc(user.name)}. Te lo recordamos para que llegues con tiempo.</p>${itemBlock(item, user.timezone)}`, appUrl);
  const text = `Hola, ${user.name}.\n\n${heading}:\n\n${itemText(item, user.timezone)}\n${appUrl ? `\n${appUrl}\n` : ''}`;
  return { subject, html, text };
}

export function digestEmail(items, user, appUrl, now = new Date()) {
  const overdue = items.filter((i) => Date.parse(i.due_at) < now.getTime());
  const upcoming = items.filter((i) => Date.parse(i.due_at) >= now.getTime());
  const exams = upcoming.filter((i) => i.type === 'exam').length;
  const parts = [plural(upcoming.length, 'pendiente', 'pendientes')];
  if (exams) parts.push(plural(exams, 'examen', 'exámenes'));
  if (overdue.length) parts.push(plural(overdue.length, 'vencida', 'vencidas'));
  const subject = `Tu resumen de hoy: ${parts.join(', ')}`;
  const section = (title, color, list) =>
    `<h2 style="font:700 12px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${color};margin:20px 0 4px">${title}</h2>${list.map((i) => itemBlock(i, user.timezone)).join('')}`;
  let body = '';
  if (overdue.length) body += section('Vencidas', C.exam, overdue);
  if (upcoming.length) body += section('Próximos 7 días', C.muted, upcoming);
  const html = layout(`Buenos días, ${user.name}`, `<p style="font-size:15px;margin:0">Esto es lo que tienes por delante esta semana.</p>${body}`, appUrl);
  const text = [
    `Buenos días, ${user.name}. Esto es lo que tienes por delante:`,
    overdue.length ? `\nVENCIDAS\n${overdue.map((i) => itemText(i, user.timezone)).join('\n\n')}` : '',
    upcoming.length ? `\nPRÓXIMOS 7 DÍAS\n${upcoming.map((i) => itemText(i, user.timezone)).join('\n\n')}` : '',
    appUrl || '',
  ].join('\n');
  return { subject, html, text };
}

export function testEmail(user, appUrl) {
  return {
    subject: 'Prueba de avisos de Horaria',
    html: layout(`Todo listo, ${user.name}`, '<p style="font-size:15px;margin:0">Los avisos por correo funcionan. A partir de ahora recibirás aquí los recordatorios de tus tareas y exámenes.</p>', appUrl),
    text: `Todo listo, ${user.name}. Los avisos por correo funcionan.`,
  };
}
