/** Consultas de tareas/exámenes compartidas entre la API y el planificador. */

// Si la asignatura es una subasignatura, el aula y el profesor vacíos se toman de la principal.
export const ITEM_SELECT = `
  SELECT i.*, s.name AS subject_name, p.name AS parent_subject_name, s.color AS subject_color,
         COALESCE(NULLIF(s.room, ''), p.room) AS room, COALESCE(NULLIF(s.teacher, ''), p.teacher) AS teacher
  FROM items i LEFT JOIN subjects s ON s.id = i.subject_id LEFT JOIN subjects p ON p.id = s.parent_id`;

/** «Física y Química · Química» para subasignaturas; el nombre sin más para el resto. */
export const subjectLabel = (row) =>
  row.subject_name ? (row.parent_subject_name ? `${row.parent_subject_name} · ${row.subject_name}` : row.subject_name) : '';

export async function attachChecklists(db, items) {
  if (!items.length) return items;
  const ids = items.map((i) => i.id);
  const rows = await db.all(`SELECT * FROM checklist_items WHERE item_id IN (${ids.map(() => '?').join(',')}) ORDER BY position, id`, ...ids);
  const byItem = new Map(ids.map((id) => [id, []]));
  for (const r of rows) byItem.get(r.item_id).push({ id: r.id, text: r.text, done: Boolean(r.done) });
  for (const item of items) item.checklist = byItem.get(item.id);
  return items;
}

export function serializeItem(i) {
  return {
    id: i.id,
    type: i.type,
    title: i.title,
    description: i.description,
    subject_id: i.subject_id,
    due_at: i.due_at,
    reminder_minutes: i.reminder_minutes,
    reminder_sent: Boolean(i.reminder_sent_at),
    done: Boolean(i.done),
    done_at: i.done_at,
    created_at: i.created_at,
    checklist: i.checklist || [],
  };
}
