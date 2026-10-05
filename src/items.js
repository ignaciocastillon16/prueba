/** Consultas de tareas/exámenes compartidas entre la API y el planificador. */

export const ITEM_SELECT = `
  SELECT i.*, s.name AS subject_name, s.color AS subject_color, s.room, s.teacher
  FROM items i LEFT JOIN subjects s ON s.id = i.subject_id`;

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
