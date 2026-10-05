const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

function layout(title, bodyHtml, appUrl) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#ffffff;border-radius:14px;padding:24px;border:1px solid #e5e7eb">
    <div style="font-size:13px;color:#6b7280;margin-bottom:4px">📚 Mi Horario</div>
    <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
    ${bodyHtml}
    ${appUrl ? `<p style="margin-top:24px"><a href="${esc(appUrl)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Abrir mi horario</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:#9ca3af;text-align:center">Puedes cambiar tus avisos en Ajustes → Avisos por correo.</p>
</div></body></html>`;
}

function itemBlock(item, timeZone) {
  const color = item.subject_color || '#6b7280';
  const checklist = (item.checklist || [])
    .map((c) => `<li style="list-style:none;margin:2px 0">${c.done ? '☑' : '☐'} ${c.done ? `<s>${esc(c.text)}</s>` : esc(c.text)}</li>`)
    .join('');
  const place = [item.room && `Aula ${item.room}`, item.teacher && `Prof. ${item.teacher}`].filter(Boolean).join(' · ');
  return `<div style="border-left:5px solid ${esc(color)};background:#f9fafb;border-radius:8px;padding:12px 14px;margin:10px 0">
  <div style="font-size:12px;font-weight:600;color:${item.type === 'exam' ? '#dc2626' : '#2563eb'}">${typeLabel(item.type).toUpperCase()}${item.subject_name ? ` · ${esc(item.subject_name)}` : ''}</div>
  <div style="font-size:16px;font-weight:600;margin:2px 0">${esc(item.title)}</div>
  <div style="font-size:14px;color:#374151">🗓 ${esc(formatDate(item.due_at, timeZone))}</div>
  ${place ? `<div style="font-size:13px;color:#6b7280">📍 ${esc(place)}</div>` : ''}
  ${item.description ? `<p style="font-size:14px;white-space:pre-wrap;margin:8px 0 0">${esc(item.description)}</p>` : ''}
  ${checklist ? `<ul style="padding:0;margin:8px 0 0;font-size:14px">${checklist}</ul>` : ''}
</div>`;
}

function itemText(item, timeZone) {
  const lines = [
    `${typeLabel(item.type)}${item.subject_name ? ` (${item.subject_name})` : ''}: ${item.title}`,
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
  const subject = `⏰ ${typeLabel(item.type)} ${when}: ${item.title}`;
  const html = layout(
    `Hola ${user.name}, tienes ${item.type === 'exam' ? 'un examen' : 'una tarea'} ${when}`,
    itemBlock(item, user.timezone),
    appUrl
  );
  const text = `Hola ${user.name},\n\nRecordatorio (${when}):\n\n${itemText(item, user.timezone)}\n${appUrl ? `\n${appUrl}\n` : ''}`;
  return { subject, html, text };
}

export function digestEmail(items, user, appUrl, now = new Date()) {
  const overdue = items.filter((i) => Date.parse(i.due_at) < now.getTime());
  const upcoming = items.filter((i) => Date.parse(i.due_at) >= now.getTime());
  const exams = upcoming.filter((i) => i.type === 'exam').length;
  const subject = `📋 Tu resumen: ${upcoming.length} pendiente(s)${exams ? `, ${exams} examen(es)` : ''}${overdue.length ? `, ${overdue.length} vencida(s)` : ''}`;
  let body = '';
  if (overdue.length) body += `<h2 style="font-size:15px;color:#dc2626;margin:16px 0 4px">Vencidas</h2>${overdue.map((i) => itemBlock(i, user.timezone)).join('')}`;
  if (upcoming.length) body += `<h2 style="font-size:15px;margin:16px 0 4px">Próximos 7 días</h2>${upcoming.map((i) => itemBlock(i, user.timezone)).join('')}`;
  const html = layout(`Buenos días, ${user.name}`, body, appUrl);
  const text = [
    `Hola ${user.name}, este es tu resumen:`,
    overdue.length ? `\nVENCIDAS:\n${overdue.map((i) => itemText(i, user.timezone)).join('\n\n')}` : '',
    upcoming.length ? `\nPRÓXIMOS 7 DÍAS:\n${upcoming.map((i) => itemText(i, user.timezone)).join('\n\n')}` : '',
    appUrl || '',
  ].join('\n');
  return { subject, html, text };
}

export function testEmail(user, appUrl) {
  return {
    subject: '✅ Prueba de avisos de Mi Horario',
    html: layout(`¡Hola ${user.name}!`, '<p style="font-size:15px">Los avisos por correo funcionan correctamente. Recibirás aquí los recordatorios de tus tareas y exámenes.</p>', appUrl),
    text: `Hola ${user.name}, los avisos por correo funcionan correctamente.`,
  };
}
