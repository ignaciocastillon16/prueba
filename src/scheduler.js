import { ITEM_SELECT, attachChecklists } from './items.js';
import { reminderEmail, digestEmail, eventReminderEmail } from './emails.js';
import { reminderPush, digestPush, eventReminderPush } from './push-messages.js';

/** Fecha (YYYY-MM-DD) y hora locales de `date` en la zona horaria indicada. */
export function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function createScheduler({ db, mailer, pusher = null, appUrl = '', logger = console }) {
  let running = false;

  async function sendReminders(now) {
    const nowIso = now.toISOString();
    const candidates = (
      await db.all(
        `${ITEM_SELECT}
         WHERE i.done = 0 AND i.reminder_minutes IS NOT NULL AND i.reminder_sent_at IS NULL AND i.due_at > ?`,
        nowIso
      )
    ).filter((i) => Date.parse(i.due_at) - i.reminder_minutes * 60000 <= now.getTime());
    await attachChecklists(db, candidates);
    for (const item of candidates) {
      const user = await db.get('SELECT * FROM users WHERE id = ?', item.user_id);
      const { delivered, attempted } = await deliver(user, {
        email: () => reminderEmail(item, user, appUrl, now),
        push: () => reminderPush(item, user, now),
        what: `el aviso de la tarea ${item.id}`,
      });
      // Si ningún canal está activo, el aviso queda pendiente por si el usuario activa alguno.
      if (attempted && delivered) await db.run('UPDATE items SET reminder_sent_at = ? WHERE id = ?', nowIso, item.id);
    }
    // Eventos
    const events = (
      await db.all('SELECT * FROM events WHERE reminder_minutes IS NOT NULL AND reminder_sent_at IS NULL AND start_at > ?', nowIso)
    ).filter((e) => Date.parse(e.start_at) - e.reminder_minutes * 60000 <= now.getTime());
    for (const ev of events) {
      const user = await db.get('SELECT * FROM users WHERE id = ?', ev.user_id);
      const { delivered, attempted } = await deliver(user, {
        email: () => eventReminderEmail(ev, user, appUrl, now),
        push: () => eventReminderPush(ev, user, now),
        what: `el aviso del evento ${ev.id}`,
      });
      if (attempted && delivered) await db.run('UPDATE events SET reminder_sent_at = ? WHERE id = ?', nowIso, ev.id);
    }
  }

  /** Envía por correo y por push según lo que tenga activado el usuario. */
  async function deliver(user, { email, push, what }) {
    let attempted = 0;
    let delivered = 0;
    if (user.email_notifications) {
      attempted += 1;
      try {
        await mailer.send({ to: user.email, ...email() });
        delivered += 1;
      } catch (err) {
        logger.error(`No se pudo enviar por correo ${what}:`, err.message);
      }
    }
    if (pusher) {
      const r = await pusher.sendToUser(user.id, push());
      if (r.devices) attempted += 1;
      if (r.sent) delivered += 1;
    }
    return { attempted, delivered };
  }

  async function sendDigests(now) {
    const users = await db.all('SELECT * FROM users WHERE daily_digest = 1');
    for (const user of users) {
      const { date, hour } = localParts(now, user.timezone);
      if (hour < user.digest_hour || user.last_digest_date === date) continue;
      const from = new Date(now.getTime() - 7 * 86400000).toISOString();
      const to = new Date(now.getTime() + 7 * 86400000).toISOString();
      const items = await attachChecklists(
        db,
        await db.all(`${ITEM_SELECT} WHERE i.user_id = ? AND i.done = 0 AND i.due_at >= ? AND i.due_at <= ? ORDER BY i.due_at`, user.id, from, to)
      );
      const events = await db.all('SELECT * FROM events WHERE user_id = ? AND start_at >= ? AND start_at <= ? ORDER BY start_at', user.id, now.toISOString(), to);
      if (items.length || events.length) {
        await deliver(user, {
          email: () => digestEmail(items, user, appUrl, now, events),
          push: () => digestPush(items, user, now, events),
          what: `el resumen diario del usuario ${user.id}`,
        });
      }
      await db.run('UPDATE users SET last_digest_date = ? WHERE id = ?', date, user.id);
    }
  }

  async function tick(now = new Date()) {
    if (running) return;
    running = true;
    try {
      await db.run('DELETE FROM sessions WHERE expires_at < ?', now.getTime());
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
