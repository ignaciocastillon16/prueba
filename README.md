# Horaria

Horaria es una aplicación web de horario escolar para usuarios registrados, con calendario mensual, horario semanal, tareas y exámenes con checklist y avisos por correo.

## Funciones

- **Cuentas de usuario.** Registro e inicio de sesión con contraseña cifrada (bcrypt). Cada usuario solo ve sus propios datos.
- **Eventos.** En el calendario puedes añadir eventos como una conferencia o una excursión: con hora o todo el día, de uno o varios días, con lugar, color y aviso.
- **Calendario mensual.** Muestra cada día con sus clases (en el color de cada asignatura) y sus tareas y exámenes. Se marca una tarea como hecha directamente desde el calendario. Al pulsar un día se abre su detalle con horas, aulas y profesorado.
- **Varios horarios.** Puedes tener uno por curso o por cuatrimestre, cada uno con sus propios días de la semana, asignaturas, tramos, clases y fondo. Si les pones fechas, el calendario mensual usa en cada día el horario que toca. Al crear uno nuevo se puede copiar otro.
- **Descargar el horario como imagen.** Genera una imagen lista para guardar en la galería del móvil o descargar en el ordenador.
- **Horario semanal.** Ocupa toda la pantalla sin hacer scroll. Pulsa una celda para asignar la asignatura y, si quieres, un aula distinta para esa clase.
- **Tramos horarios y días visibles.** En *Ajustes* eliges qué días de la semana aparecen (por ejemplo, de lunes a viernes o también el sábado) y defines las horas de clase y los recreos.
- **Asignaturas.** Cada una tiene nombre, abreviatura, aula, profesor/a y color propio, y pertenece a un horario.
- **Subasignaturas.** Dentro de una asignatura puedes crear subasignaturas (por ejemplo, «Química» y «Laboratorio» dentro de «Física y Química»). Se usan en el horario y en tareas y exámenes; si no tienen aula o profesor propios, usan los de su asignatura.
- **Tareas y exámenes.** Con fecha y hora, asignatura, descripción y lista de comprobación (checklist) para ir marcando los pasos. Hay una vista de lista con vencidas, hoy, próximos 7 días, más adelante y completadas.
- **Notificaciones en el móvil y el ordenador.** Los recordatorios llegan como notificación aunque la web esté cerrada. Se activan en Ajustes, en cada dispositivo.
- **Se adapta a cualquier pantalla.** Móviles (también en horizontal), tablets, portátiles y monitores grandes.
- **Avisos por correo.** Cada tarea o examen puede tener su recordatorio (a la hora, 15 min, 1 h, 1 día, 1 semana antes…). Además existe un resumen diario opcional a la hora que elijas. Hay un botón para enviar un correo de prueba.

## Probarla en tu ordenador

Requiere **Node.js 22.13 o superior**.

```bash
npm install
cp .env.example .env
npm start
```

Abre http://localhost:3000. Si dejas `MYSQL_HOST` vacío, los datos se guardan en un archivo SQLite local, sin instalar nada más. Sin SMTP configurado, los correos aparecen en la consola en lugar de enviarse.

## Publicarla: base de datos en Hostinger y web en Render

### 1. Crear la base de datos en Hostinger

1. En hPanel entra en **Sitios web → Administrar → Bases de datos → Administración**.
2. Crea una base de datos nueva con su usuario y una contraseña larga. Hostinger añade un prefijo, por ejemplo `u123456789_horario`. Apunta los tres datos tal como aparecen.
3. Ve a **Bases de datos → MySQL remoto**. Marca **Cualquier host**, elige la base de datos y pulsa **Crear**.
4. En esa misma página aparece arriba el **host** del servidor MySQL (un nombre como `srv123.hstgr.io` o una IP). Apúntalo. El puerto es `3306`.

No hace falta crear tablas: la app las crea sola la primera vez que arranca.

### 2. Preparar el correo con Brevo

El plan gratuito de Render bloquea los puertos de correo 25, 465 y 587. Por eso el correo de Hostinger no sirve ahí. Brevo es gratis (300 correos al día) y admite el puerto 2525, que no está bloqueado.

1. Crea una cuenta en [brevo.com](https://www.brevo.com) y verifica el correo que usarás como remitente (**Remitentes y dominios**).
2. En **SMTP y API → SMTP**, copia el **usuario SMTP** y genera una **clave SMTP**.

Si pagas un plan de Render, también puedes usar el correo de Hostinger con `smtp.hostinger.com` y el puerto 465.

### 3. Crear el servicio en Render

1. Sube este proyecto a GitHub, si no lo está ya.
2. En [render.com](https://render.com) pulsa **New → Blueprint** y elige el repositorio. Render lee el archivo `render.yaml`.
3. Rellena las variables que te pide:

| Variable | Valor |
| --- | --- |
| `MYSQL_HOST` | El host de la página MySQL remoto de Hostinger |
| `MYSQL_DATABASE` | El nombre completo de la base de datos, con el prefijo |
| `MYSQL_USER` | El usuario completo, con el prefijo |
| `MYSQL_PASSWORD` | La contraseña de ese usuario |
| `SMTP_USER` | El usuario SMTP de Brevo |
| `SMTP_PASS` | La clave SMTP de Brevo |
| `MAIL_FROM` | `Horaria <tu-correo-verificado@ejemplo.com>` |

4. Pulsa **Apply**. Cuando termine, la web estará en `https://horaria.onrender.com` o similar.
5. Entra, crea tu cuenta y pulsa **Ajustes → Enviar correo de prueba**.

Si la conexión a la base de datos falla, el registro de Render (**Logs**) muestra el motivo exacto.

### 4. Mantenerla despierta para que lleguen los avisos

En el plan gratuito, Render apaga la web tras 15 minutos sin visitas. Mientras está apagada no se envían recordatorios. Para evitarlo:

1. Crea una cuenta gratuita en [cron-job.org](https://cron-job.org).
2. Añade una tarea que visite `https://TU-WEB.onrender.com/api/health` cada 10 minutos.

Las 750 horas gratuitas al mes de Render bastan para tener un servicio encendido todo el mes. Un plan de pago de Render no se apaga y no necesita esto.

### Notificaciones push

No hace falta configurar nada. La primera vez que arranca, el servidor crea sus claves de notificaciones y las guarda en la base de datos, así que se mantienen aunque Render se reinicie. Cada persona las activa en **Ajustes → Avisos → Activar notificaciones**.

- **Android y ordenador:** funcionan desde Chrome, Edge, Firefox o Safari.
- **iPhone y iPad:** hace falta iOS 16.4 o posterior. Primero hay que abrir la web en Safari, pulsar **Compartir → Añadir a pantalla de inicio** y abrir Horaria desde ese icono. La app lo explica en Ajustes.

Si prefieres fijar tú las claves, define `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (se generan con `npx web-push generate-vapid-keys`). Si las cambias, cada dispositivo tendrá que volver a activar las notificaciones.

### Seguridad de la base de datos

"Cualquier host" permite que cualquiera intente conectarse, aunque sin la contraseña no puede entrar. Usa una contraseña larga y única. Si quieres cerrarlo más, en Render abre el servicio, pulsa **Connect → Outbound** y copia sus direcciones IP de salida. Después añádelas una a una en **MySQL remoto** en lugar de "Cualquier host".

## Desarrollo

```bash
npm run dev   # reinicia al cambiar el código
npm test      # pruebas de la API y de los avisos (SQLite)
TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/pruebas npm test   # las mismas pruebas contra MySQL
```

Las pruebas contra MySQL borran las tablas de esa base de datos. Úsalas solo con una base de datos de pruebas.

Estructura:

| Ruta | Contenido |
| --- | --- |
| `src/api.js` | API REST: autenticación, asignaturas, tramos, horario, tareas |
| `src/scheduler.js` | Envío de recordatorios y resumen diario |
| `src/emails.js` | Plantillas de los correos |
| `src/db.js` | Conexión y tablas de la base de datos (MySQL o SQLite) |
| `public/` | Interfaz web (HTML, CSS y JavaScript sin frameworks) |
| `public/fonts/` | Tipografías Figtree y Fraunces (licencia SIL Open Font License) |
| `test/` | Pruebas automáticas |
