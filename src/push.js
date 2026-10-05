import crypto from 'node:crypto';
import webpush from 'web-push';

/*
 * Notificaciones push (Web Push con claves VAPID).
 * Las claves se pueden dar con VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY. Si no existen,
 * se generan una vez y se guardan en la base de datos, así sobreviven a los reinicios.
 */

export const hashEndpoint = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

export async function loadVapidKeys(db, env = process.env) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const read = async (name) => (await db.get('SELECT value FROM app_settings WHERE name = ?', name))?.value;
  let publicKey = await read('vapid_public_key');
  let privateKey = await read('vapid_private_key');
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    await db.tx(async (t) => {
      await t.run('DELETE FROM app_settings WHERE name IN (?, ?)', 'vapid_public_key', 'vapid_private_key');
      await t.run('INSERT INTO app_settings (name, value) VALUES (?, ?)', 'vapid_public_key', publicKey);
      await t.run('INSERT INTO app_settings (name, value) VALUES (?, ?)', 'vapid_private_key', privateKey);
    });
  }
  return { publicKey, privateKey };
}

/** Contacto que exigen los servicios push (Apple solo acepta mailto: o https:). */
export function vapidSubject(env = process.env, appUrl = '') {
  if (env.VAPID_SUBJECT) return env.VAPID_SUBJECT;
  if (/^https:\/\//.test(appUrl)) return appUrl;
  const email = String(env.MAIL_FROM || env.SMTP_USER || '').match(/[^\s<>]+@[^\s<>]+/)?.[0];
  return email ? `mailto:${email}` : 'mailto:avisos@horaria.app';
}

/**
 * @param send función que entrega el mensaje (por defecto, web-push). En las pruebas se sustituye.
 */
export function createPusher({ db, keys, subject, send = webpush.sendNotification, logger = console }) {
  const vapidDetails = { subject, publicKey: keys.publicKey, privateKey: keys.privateKey };
  return {
    publicKey: keys.publicKey,

    async subscribe(userId, sub, userAgent = '') {
      const hash = hashEndpoint(sub.endpoint);
      await db.tx(async (t) => {
        await t.run('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', hash);
        await t.run(
          'INSERT INTO push_subscriptions (user_id, endpoint_hash, endpoint, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          userId, hash, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent.slice(0, 250), new Date().toISOString()
        );
      });
    },

    async unsubscribe(userId, endpoint) {
      await db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?', userId, hashEndpoint(endpoint));
    },

    async countDevices(userId) {
      return Number((await db.get('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', userId)).n);
    },

    /** Envía una notificación a todos los dispositivos del usuario. Devuelve cuántos la recibieron. */
    async sendToUser(userId, payload) {
      const subs = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', userId);
      let sent = 0;
      let failed = 0;
      for (const s of subs) {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 24 * 3600, urgency: 'high', vapidDetails });
          sent += 1;
        } catch (err) {
          failed += 1;
          // 404 y 410: el dispositivo ya no existe o retiró el permiso. Se borra.
          if (err.statusCode === 404 || err.statusCode === 410) await db.run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
          else logger.error(`No se pudo enviar la notificación push (${err.statusCode || err.message})`);
        }
      }
      return { sent, failed, devices: subs.length };
    },
  };
}
