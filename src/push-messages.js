import { relativeTime } from './emails.js';
import { subjectLabel } from './items.js';

const typeLabel = (t) => (t === 'exam' ? 'Examen' : 'Tarea');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const shortDate = (iso, timeZone) =>
  new Intl.DateTimeFormat('es-ES', { timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function reminderPush(item, user, now = new Date()) {
  const when = relativeTime(item.due_at, now);
  const parts = [`${typeLabel(item.type)}${item.subject_name ? ` de ${subjectLabel(item)}` : ''}, ${when}`, shortDate(item.due_at, user.timezone)];
  if (item.room) parts.push(`aula ${item.room}`);
  const pending = (item.checklist || []).filter((c) => !c.done).length;
  if (pending) parts.push(plural(pending, 'paso pendiente', 'pasos pendientes'));
  return { title: item.title, body: parts.join(' · '), tag: `item-${item.id}`, url: '/#items' };
}

export function digestPush(items, user, now = new Date()) {
  const overdue = items.filter((i) => Date.parse(i.due_at) < now.getTime());
  const upcoming = items.filter((i) => Date.parse(i.due_at) >= now.getTime());
  const exams = upcoming.filter((i) => i.type === 'exam').length;
  const parts = [`${plural(upcoming.length, 'pendiente', 'pendientes')} esta semana`];
  if (exams) parts.push(plural(exams, 'examen', 'exámenes'));
  if (overdue.length) parts.push(plural(overdue.length, 'vencida', 'vencidas'));
  let body = `${parts.join(', ')}.`;
  if (upcoming[0]) body += ` Lo próximo: ${upcoming[0].title} (${relativeTime(upcoming[0].due_at, now)}).`;
  return { title: `Buenos días, ${user.name.split(' ')[0]}`, body, tag: 'digest', url: '/#items' };
}

export function testPush() {
  return { title: 'Horaria', body: 'Las notificaciones funcionan en este dispositivo.', tag: 'test', url: '/#settings' };
}
