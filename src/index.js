import fs from 'node:fs';
import { openDb } from './db.js';
import { createMailer } from './mailer.js';
import { createScheduler } from './scheduler.js';
import { createApp } from './server.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const db = openDb(process.env.DB_FILE || 'data/horario.db');
const mailer = createMailer();
const app = createApp({ db, mailer, appUrl, trustProxy: process.env.TRUST_PROXY === 'true' });

app.listen(port, () => {
  console.log(`📚 Mi Horario escuchando en ${appUrl}`);
  if (!mailer.configured) console.log('⚠️  SMTP no configurado: los correos se mostrarán en la consola. Revisa el archivo .env.');
});

createScheduler({ db, mailer, appUrl }).start(Number(process.env.REMINDER_INTERVAL_MS || 60000));
