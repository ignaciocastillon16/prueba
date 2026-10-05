import nodemailer from 'nodemailer';

/**
 * Crea el servicio de correo. Si no hay SMTP configurado, los correos
 * no se envían: se muestran en la consola para poder probar la app.
 */
export function createMailer(env = process.env, logger = console) {
  const configured = Boolean(env.SMTP_HOST);
  const port = Number(env.SMTP_PORT || 587);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  const transport = configured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure,
        // Sin TLS directo, exige STARTTLS para no enviar la contraseña en claro (puertos 587 y 2525).
        requireTLS: !secure && env.SMTP_REQUIRE_TLS !== 'false',
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  const from = env.MAIL_FROM || env.SMTP_USER || 'Horaria <no-reply@localhost>';

  return {
    configured,
    async send({ to, subject, text, html }) {
      const info = await transport.sendMail({ from, to, subject, text, html });
      if (!configured) logger.log(`[correo simulado, configura SMTP para enviarlo] Para: ${to} | Asunto: ${subject}\n${text}\n`);
      return info;
    },
  };
}
