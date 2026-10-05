import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp({ db, mailer, pusher = null, appUrl = '', trustProxy = false }) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
    });
    next();
  });
  app.use('/api', createApi({ db, mailer, pusher, appUrl }));
  app.use(
    express.static(publicDir, {
      index: 'index.html',
      // El service worker y la web siempre se comprueban, para que las actualizaciones lleguen al momento.
      setHeaders: (res, file) => {
        if (/(sw\.js|index\.html|\.webmanifest)$/.test(file)) res.set('Cache-Control', 'no-cache');
      },
    })
  );
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(publicDir, 'index.html')) : next()));
  return app;
}
