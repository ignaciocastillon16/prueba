# 📚 Mi Horario

Aplicación web de horario escolar para usuarios registrados, con calendario mensual, horario semanal, tareas y exámenes con checklist y avisos por correo.

## Funciones

- **Cuentas de usuario.** Registro e inicio de sesión con contraseña cifrada (bcrypt). Cada usuario solo ve sus propios datos.
- **Calendario mensual.** Muestra cada día con sus clases (en el color de cada asignatura) y sus tareas y exámenes. Se marca una tarea como hecha directamente desde el calendario. Al pulsar un día se abre su detalle con horas, aulas y profesorado.
- **Horario semanal.** Ocupa toda la pantalla sin hacer scroll. Pulsa una celda para asignar la asignatura y, si quieres, un aula distinta para esa clase.
- **Tramos horarios y días visibles.** En *Ajustes* eliges qué días de la semana aparecen (por ejemplo, de lunes a viernes o también el sábado) y defines las horas de clase y los recreos.
- **Asignaturas.** Cada una tiene nombre, abreviatura, aula, profesor/a y color propio.
- **Tareas y exámenes.** Con fecha y hora, asignatura, descripción y lista de comprobación (checklist) para ir marcando los pasos. Hay una vista de lista con vencidas, hoy, próximos 7 días, más adelante y completadas.
- **Avisos por correo.** Cada tarea o examen puede tener su recordatorio (a la hora, 15 min, 1 h, 1 día, 1 semana antes…). Además existe un resumen diario opcional a la hora que elijas. Hay un botón para enviar un correo de prueba.

## Puesta en marcha

Requiere **Node.js 22.13 o superior** (usa la base de datos SQLite integrada en Node, sin dependencias nativas).

```bash
npm install
cp .env.example .env   # y edita los datos de SMTP
npm start
```

Abre http://localhost:3000, crea una cuenta y empieza por *Asignaturas* y *Horario*.

Sin SMTP configurado la aplicación funciona igual, pero los correos se muestran en la consola del servidor en lugar de enviarse.

### Configurar el correo

Rellena en `.env` las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`. Con Gmail necesitas una [contraseña de aplicación](https://myaccount.google.com/apppasswords). También sirven Outlook, Brevo, Mailgun, SendGrid o el SMTP de tu hosting.

El servidor revisa cada minuto qué avisos toca enviar, así que debe estar siempre encendido para que lleguen los correos.

### Publicarla en Internet

Funciona en cualquier servicio que ejecute Node.js con disco persistente (Render, Railway, Fly.io, un VPS…):

- Comando de arranque: `npm start`.
- Define `APP_URL` con la dirección pública y `TRUST_PROXY=true` si va detrás de HTTPS.
- Guarda `DB_FILE` en un volumen persistente para no perder los datos.

## Desarrollo

```bash
npm run dev   # reinicia al cambiar el código
npm test      # pruebas de la API y de los avisos
```

Estructura:

| Ruta | Contenido |
| --- | --- |
| `src/api.js` | API REST: autenticación, asignaturas, tramos, horario, tareas |
| `src/scheduler.js` | Envío de recordatorios y resumen diario |
| `src/emails.js` | Plantillas de los correos |
| `src/db.js` | Esquema de la base de datos SQLite |
| `public/` | Interfaz web (HTML, CSS y JavaScript sin frameworks) |
| `test/` | Pruebas automáticas |
