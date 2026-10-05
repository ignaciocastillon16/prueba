import fs from 'node:fs';
import { openDb, dbConfigFromEnv } from './db.js';
import { createMailer } from './mailer.js';
import { createScheduler } from './scheduler.js';
import { createApp } from './server.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT || 3000);
// Render define RENDER_EXTERNAL_URL automáticamente con la dirección pública.
const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
const dbConfig = dbConfigFromEnv();

let db;
try {
  db = await openDb(dbConfig);
} catch (err) {
  console.error(`❌ No se pudo conectar a la base de datos (${dbConfig.mysql ? 'MySQL' : 'SQLite'}): ${err.message}`);
  if (dbConfig.mysql) {
    console.error('   Revisa MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE, y que en Hostinger');
    console.error('   (Bases de datos → MySQL remoto) esté permitida la conexión desde "Cualquier host".');
  }
  process.exit(1);
}

const mailer = createMailer();
const trustProxy = process.env.TRUST_PROXY ? process.env.TRUST_PROXY === 'true' : Boolean(process.env.RENDER);
const app = createApp({ db, mailer, appUrl, trustProxy });

app.listen(port, () => {
  console.log(`📚 Mi Horario escuchando en ${appUrl} (base de datos: ${dbConfig.mysql ? 'MySQL' : 'SQLite'})`);
  if (!mailer.configured) console.log('⚠️  SMTP no configurado: los correos se mostrarán en la consola. Revisa el archivo .env.');
});

createScheduler({ db, mailer, appUrl }).start(Number(process.env.REMINDER_INTERVAL_MS || 60000));
