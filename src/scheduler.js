import { ITEM_SELECT, attachChecklists } from './items.js';
import { reminderEmail, digestEmail } from './emails.js';

/** Fecha (YYYY-MM-DD) y hora locales de `date` en la zona horaria indicada. */
export function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function createScheduler({ db, mailer, appUrl = '', logger = console }) {
  let running = false;

  async function sendReminders(now) {
    const nowIso = now.toISOString();
    const candidates = db
      .prepare(
        `${ITEM_SELECT} JOIN users u ON u.id = i.user_id
         WHERE i.done = 0 AND i.reminder_minutes IS NOT NULL AND i.reminder_sent_at IS NULL
           AND u.email_notifications = 1 AND i.due_at > ?`
      )
      .all(nowIso)
      .filter((i) => Date.parse(i.due_at) - i.reminder_minutes * 60000 <= now.getTime());
    attachChecklists(db, candidates);
    for (const item of candidates) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(item.user_id);
      try {
        await mailer.send({ to: user.email, ...reminderEmail(item, user, appUrl, now) });
        db.prepare('UPDATE items SET reminder_sent_at = ? WHERE id = ?').run(nowIso, item.id);
      } catch (err) {
        logger.error(`No se pudo enviar el aviso de la tarea ${item.id}:`, err.message);
      }
    }
  }

  async function sendDigests(now) {
    const users = db.prepare('SELECT * FROM users WHERE daily_digest = 1 AND email_notifications = 1').all();
    for (const user of users) {
      const { date, hour } = localParts(now, user.timezone);
      if (hour < user.digest_hour || user.last_digest_date === date) continue;
      const from = new Date(now.getTime() - 7 * 86400000).toISOString();
      const to = new Date(now.getTime() + 7 * 86400000).toISOString();
      const items = attachChecklists(
        db,
        db.prepare(`${ITEM_SELECT} WHERE i.user_id = ? AND i.done = 0 AND i.due_at >= ? AND i.due_at <= ? ORDER BY i.due_at`).all(user.id, from, to)
      );
      try {
        if (items.length) await mailer.send({ to: user.email, ...digestEmail(items, user, appUrl, now) });
        db.prepare('UPDATE users SET last_digest_date = ? WHERE id = ?').run(date, user.id);
      } catch (err) {
        logger.error(`No se pudo enviar el resumen diario a ${user.id}:`, err.message);
      }
    }
  }

  async function tick(now = new Date()) {
    if (running) return;
    running = true;
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now.getTime());
      await sendReminders(now);
      await sendDigests(now);
    } catch (err) {
      logger.error('Error en el planificador de avisos:', err);
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start(intervalMs = 60000) {
      const timer = setInterval(tick, intervalMs);
      timer.unref?.();
      tick();
      return () => clearInterval(timer);
    },
  };
}
