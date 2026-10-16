# HU-USR-08 — Configuración de cuenta

## Estado inicial

La ruta `/dashboard/account-settings` tenía pestañas Cuenta y Notificaciones. Cuenta
mostraba datos demo de Materio, campos inexistentes en `User` y una foto demo con
previsualización local mediante FileReader. Guardar y desactivar no persistían nada.
No había hooks, servicios ni interfaces específicos de autogestión, ni formulario
para cambiar la contraseña. Notificaciones continúa como vista de presentación,
fuera del alcance de esta historia.

`User` ya contenía `name`, `lastname`, `email`, `ci`, `avatar`, `password` y
`isActive`, además de auditoría y relaciones con roles y sesiones. Los endpoints
administrativos aceptaban ID y exigían permisos `user.*`; no eran apropiados para
autogestión. La desactivación administrativa ya era lógica y rechazaba desactivarse
a sí mismo. La reactivación administrativa existente se conserva.

## API de autogestión

Todas las rutas están bajo el prefijo `/api`. Se identifican exclusivamente con
`@CurrentUser().idUser`, validado por el guard JWT y la sesión almacenada. No
requieren permisos administrativos ni reciben un ID de usuario como destino.

| Método y ruta               | Entrada                                          | Resultado                                             |
| --------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `GET /users/me`             | Ninguna                                          | Nombre, apellido, email y documento actuales          |
| `PATCH /users/me`           | Subconjunto de `name`, `lastname`, `email`, `ci` | Los cuatro datos personales actualizados              |
| `POST /users/me/password`   | `currentPassword`, `password`                    | Contraseña actualizada y todas las sesiones revocadas |
| `POST /users/me/deactivate` | Ninguna                                          | Cuenta inactiva y todas las sesiones revocadas        |

Son rutas nuevas porque no existían operaciones seguras equivalentes para cuenta
propia. Se reutilizan `GET /auth/me` para autenticar y refrescar la identidad en la
interfaz, el cliente HTTP común y sus mecanismos de tokens. Las operaciones nuevas
reutilizan internamente `UsersService.getOneById`, `UsersService.update`,
`normalizeEmail`, las validaciones personales y de contraseña de `RegisterPatientDto`,
`hashPassword` y los servicios de revocación de sesiones. No se llama a los endpoints
administrativos desde el formulario propio.

El DTO de perfil es una selección explícita de datos personales. Rechaza `idUser`,
`roles`, `roleNames`, `permissions` e `isActive`. El pipe global elimina campos
desconocidos y el servicio vuelve a seleccionar los cuatro campos permitidos; por
ello tampoco se actualizan fechas, flags internos, contraseña, avatar ni campos
clínicos mediante el PATCH. La respuesta utiliza una proyección explícita que no
expone hashes, tokens, permisos, roles ni auditoría interna.

El backend normaliza el email con la utilidad existente y comprueba duplicados de
email y documento, incluyendo errores de unicidad producidos por solicitudes
concurrentes. El frontend envía los cambios parciales sin agregar normalización de
email y deshabilita Guardar cuando no hay modificaciones.

## Contraseña y sesiones

La contraseña actual es obligatoria y se verifica con bcrypt. La nueva aplica la
política existente: mínimo ocho caracteres, mayúscula, minúscula, número y máximo
72 bytes; no se exige símbolo. Se rechaza reutilizar la actual. La confirmación se
valida en frontend y no se envía ni persiste.

La escritura del hash y la revocación de todas las sesiones se realizan en una
transacción, bloqueando la fila del usuario para serializar cambios de contraseña.
Se reutiliza el motivo `PASSWORD_CHANGED`. Incluye la sesión actual: el cliente
limpia las cookies y emite el evento de cierre existente; AuthGuard elimina el
usuario de memoria y redirige a `/login`. El formulario informa previamente de este
comportamiento y maneja errores, carga y éxito. La recuperación por correo no se
modifica.

La configuración de cookies se conserva: SameSite strict y Secure en producción,
con la gestión cliente existente. No se cambia la autenticación ni se introduce un
mecanismo de CSRF o sesiones nuevo.

## Desactivación y administración

Un diálogo accesible solicita confirmación y enfoca inicialmente Cancelar. Durante
el envío se impiden dobles solicitudes y el cierre del diálogo. La operación
actualiza `isActive=false`, `deletedBy` y `updatedBy`; no elimina la fila ni sus
relaciones. La revocación y el cambio de estado son atómicos. El cliente limpia
autenticación y redirige a `/login` únicamente tras una respuesta exitosa.

La autenticación existente ya filtra usuarios inactivos y devuelve el mismo error
genérico de credenciales inválidas. La estrategia JWT consulta usuario y sesión en
cada solicitud, y refresh también rechaza usuarios inactivos. Estos controles no
dependen del contenido histórico del JWT.

No existía protección del último SUPERADMIN en los servicios revisados. La
autodesactivación ahora rechaza al último usuario activo con el rol SUPERADMIN
activo. Un bloqueo transaccional consultivo de PostgreSQL (`81008`) serializa las
autodesactivaciones, de modo que dos administradores no puedan ambos observar al
otro como alternativa y desactivarse simultáneamente. Esta comprobación de
integridad no concede permisos ni permite acceso clínico.

La protección se limita a autogestión. Los flujos administrativos existentes de
desactivación, edición de roles y permisos no fueron modificados. La protección
global frente a operaciones administrativas concurrentes debe evaluarse en una
historia independiente. La reactivación propia continúa fuera de alcance.

## Interfaz y avatar

Se mantienen la ruta, pestañas, layout, tema y componentes MUI existentes. Cuenta
contiene información personal, seguridad y desactivación. Se reutilizan Alert,
Button, Card, Grid, TextField y Dialog, así como el patrón de errores HTTP y las
validaciones compartidas. Los campos se distribuyen en una columna en móvil y dos
desde `sm`; los botones y acciones del diálogo admiten ajuste de línea. Se usan
colores de tema y `error.main` para la zona destructiva.

En la entrega inicial se mostraron iniciales y se retiraron la foto demo y los controles de subida sin
persistencia. Aunque `User.avatar` existe, integrar carga, autorización de archivos,
validación, reemplazo y eliminación requiere decisiones y endpoints adicionales.
Se recomienda una historia de foto de perfil posterior a Storage (#82), sin
migraciones ni integración de imágenes dentro de esa entrega. La ampliación posterior
de menú y foto ya se implementó y está documentada en [account-avatar-neon.md](account-avatar-neon.md).

## Archivos

- `apps/api/src/controllers/users/my-account.controller.ts`
- `apps/api/src/controllers/users/my-account.http.spec.ts`
- `apps/api/src/dtos/users/my-account.dto.ts`
- `apps/api/src/services/users/my-account.service.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/services/sessions/sessions.service.ts`
- `apps/web/src/services/users/myAccountService.ts`
- `apps/web/src/services/users/myAccountService.test.ts`
- `apps/web/src/utils/patientRegistration.ts`
- `apps/web/src/views/account-settings/account/AccountDetails.tsx`
- `apps/web/src/views/account-settings/account/AccountSecurity.tsx`
- `apps/web/src/views/account-settings/account/AccountDelete.tsx`
- `apps/web/src/views/account-settings/account/Account.test.tsx`
- `apps/web/src/views/account-settings/account/index.tsx`
- Este documento.

## Verificación automatizada

Se agregan 25 pruebas HTTP de backend con guards, estrategia JWT, servicios,
validaciones e interceptor reales, y repositorios simulados. Cubren acceso anónimo,
proyección segura, cambios parciales, normalización, duplicados, campos privilegiados,
intentos de modificar otro usuario, política y verificación de contraseña, hash,
autenticación con contraseña anterior/nueva, revocación, conservación de datos,
rechazo de usuarios inactivos y restricción del último SUPERADMIN. No sustituyen una
prueba de concurrencia contra PostgreSQL real.

Se agregan 18 pruebas de frontend: cuatro de servicio y catorce de componentes.
Cubren carga, errores, validaciones, edición, envío parcial, carga durante envíos,
éxito, restauración, cambio y confirmación de contraseña, diálogo, cancelación,
confirmación, duplicados de envío y limpieza de autenticación tras éxito. Siguen el
patrón existente de Vitest con renderizado servidor y captura de interacciones.

Resultados: 438 pruebas de backend (45 suites) y 227 de frontend (34 archivos)
exitosas. Lint, format y build pasan en ambas aplicaciones. TypeScript frontend
también pasa con `tsc --noEmit`. No se deshabilitaron controles. El build conserva
un aviso preexistente sobre antigüedad de baseline-browser-mapping.

Revisión visual en navegador de la aplicación real con API local de datos
ficticios: escritorio 1440×900, tablet 768×1024 y móvil 390×844, sin desborde
horizontal. Se verificaron edición y éxito de perfil, modo oscuro y diálogo móvil.
Cancelar recibe el foco al finalizar la transición, Tab lleva a confirmar y Escape
cierra y restaura el foco al botón de origen. No se probaron cambios destructivos
sobre cuentas reales ni se utilizaron datos médicos. Las pruebas automatizadas
cubren contraseña y desactivación con el backend real y persistencia simulada.

`git diff --check` pasa. No quedan decisiones funcionales pendientes en el alcance;
la integración de foto y una protección global frente a cambios administrativos
concurrentes quedan recomendadas como historias separadas. No se ejecutó CI remota
porque no se solicitó push ni PR.

Las pruebas HTTP y el build se ejecutaron fuera del aislamiento tras comprobar que
el entorno restringido bloqueaba conexiones localhost y el progreso de Next.js.
Vitest usó una carpeta temporal dentro de node_modules para evitar errores de
permisos del directorio temporal del aislamiento.

No se realizan commit, push, PR ni merge.
