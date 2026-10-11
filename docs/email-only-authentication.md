# MEDISUR — Autenticación exclusivamente por correo

Verificación: 11 de octubre de 2026. Se leyó completamente AGENTS.md y se revisaron entidad, DTOs, controladores, servicios, guards, estrategia JWT, sesiones, migraciones, seeds, frontend, pruebas y documentación antes de editar. Los cambios locales anteriores de HU-USR-02 se conservaron y adaptaron; el listado siguiente incluye esos archivos.

## 1. Dependencias iniciales

El modelo exigía una columna única de nombre de usuario; login y consulta autenticada usaban ese campo. También dependían de él creación, edición, búsqueda, endpoint por nombre de usuario, catálogo de permisos, JWT, respuesta de sesión, interfaces, menú de cuenta, formulario administrativo, registro público, aviso temporal de registro, mocks, fixtures, pruebas y ejemplos de Materio. No se encontraron estrategias alternativas `findByUsername`, `usernameOrEmail` o `loginUsername`. `identifier` representaba el nombre de usuario en el aviso de registro. El lockfile contiene nombres de dependencias con esa palabra que no representan credenciales.

Archivos con referencias encontradas inicialmente (incluidos los cambios locales de registro):

- `apps/api/src/common/test-mocks/users.mock.ts`
- `apps/api/src/common/types/auth-response.type.ts`
- `apps/api/src/common/types/jwt-payload.type.ts`
- `apps/api/src/controllers/auth/auth.http.spec.ts`
- `apps/api/src/controllers/auth/register.http.spec.ts`
- `apps/api/src/controllers/users/users.controller.ts`
- `apps/api/src/core/guards/permissions/permissions.http.spec.ts`
- `apps/api/src/core/interceptors/response/response.interceptor.spec.ts`
- `apps/api/src/core/pipes/validation.pipe.spec.ts`
- `apps/api/src/core/strategies/jwt/jwt.strategy.spec.ts`
- `apps/api/src/database/migrations/1791261818129-GenerateInitialTables.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/dtos/auth/login.dto.ts`
- `apps/api/src/dtos/auth/register-patient.dto.ts`
- `apps/api/src/dtos/users/users.dto.ts`
- `apps/api/src/entities/users/users.entity.ts`
- `apps/api/src/services/auth/auth.service.spec.ts`
- `apps/api/src/services/auth/auth.service.ts`
- `apps/api/src/services/users/users.service.spec.ts`
- `apps/api/src/services/users/users.service.ts`
- `apps/web/src/components/layout/shared/UserDropdown.tsx`
- `apps/web/src/services/auth/authService.test.ts`
- `apps/web/src/services/users/usersService.test.ts`
- `apps/web/src/types/auth.ts`
- `apps/web/src/types/users.ts`
- `apps/web/src/utils/patientRegistration.test.ts`
- `apps/web/src/utils/patientRegistration.ts`
- `apps/web/src/utils/registrationNotice.test.ts`
- `apps/web/src/utils/registrationNotice.ts`
- `apps/web/src/views/dashboard/Table.tsx`
- `apps/web/src/views/form-layouts/FormLayoutsAlignment.tsx`
- `apps/web/src/views/pages/auth/Login.submit.test.tsx`
- `apps/web/src/views/pages/auth/Login.test.tsx`
- `apps/web/src/views/pages/auth/Login.tsx`
- `apps/web/src/views/pages/auth/Register.submit.test.tsx`
- `apps/web/src/views/pages/auth/Register.tsx`
- `apps/web/src/views/users/UsersAdministration.status.test.tsx`
- `apps/web/src/views/users/UsersAdministration.tsx`
- `docs/hu-usr-02-patient-registration.md`
- `docs/hu-usr-04-users.md`
- `docs/hu-usr-05-roles-permissions.md`

## 2. Archivos modificados o añadidos

- `apps/api/src/common/test-mocks/users.mock.ts`
- `apps/api/src/common/types/auth-response.type.ts`
- `apps/api/src/common/types/jwt-payload.type.ts`
- `apps/api/src/common/utils/normalize-email.ts`
- `apps/api/src/controllers/auth/auth.controller.ts`
- `apps/api/src/controllers/auth/auth.http.spec.ts`
- `apps/api/src/controllers/auth/register.http.spec.ts`
- `apps/api/src/controllers/users/users.controller.ts`
- `apps/api/src/core/guards/permissions/permissions.http.spec.ts`
- `apps/api/src/core/interceptors/response/response.interceptor.spec.ts`
- `apps/api/src/core/pipes/validation.pipe.spec.ts`
- `apps/api/src/core/strategies/jwt/jwt.strategy.spec.ts`
- `apps/api/src/database/email-only-authentication.spec.ts`
- `apps/api/src/database/migrations/1791763200000-EmailOnlyAuthentication.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/dtos/auth/login.dto.ts`
- `apps/api/src/dtos/auth/register-patient.dto.ts`
- `apps/api/src/dtos/users/users-query.dto.ts`
- `apps/api/src/dtos/users/users.dto.ts`
- `apps/api/src/entities/users/users.entity.ts`
- `apps/api/src/services/auth/auth.service.spec.ts`
- `apps/api/src/services/auth/auth.service.ts`
- `apps/api/src/services/users/users.service.spec.ts`
- `apps/api/src/services/users/users.service.ts`
- `apps/web/src/components/layout/shared/UserDropdown.tsx`
- `apps/web/src/services/auth/authService.test.ts`
- `apps/web/src/services/auth/authService.ts`
- `apps/web/src/services/users/usersService.test.ts`
- `apps/web/src/types/auth.ts`
- `apps/web/src/types/users.ts`
- `apps/web/src/utils/patientRegistration.test.ts`
- `apps/web/src/utils/patientRegistration.ts`
- `apps/web/src/utils/registrationNotice.test.ts`
- `apps/web/src/utils/registrationNotice.ts`
- `apps/web/src/views/dashboard/Table.tsx`
- `apps/web/src/views/form-layouts/FormLayoutsAlignment.tsx`
- `apps/web/src/views/pages/auth/Login.submit.test.tsx`
- `apps/web/src/views/pages/auth/Login.test.tsx`
- `apps/web/src/views/pages/auth/Login.tsx`
- `apps/web/src/views/pages/auth/Register.submit.test.tsx`
- `apps/web/src/views/pages/auth/Register.tsx`
- `apps/web/src/views/users/UsersAdministration.status.test.tsx`
- `apps/web/src/views/users/UsersAdministration.tsx`
- `docs/email-only-authentication.md`
- `docs/hu-usr-01-login.md`
- `docs/hu-usr-02-patient-registration.md`
- `docs/hu-usr-04-users.md`
- `docs/hu-usr-05-roles-permissions.md`

## 3. Entidad User

Se eliminó la propiedad y columna `username`. Email conserva NOT NULL y UNIQUE. Se añadió `CHK_users_email_normalized` para exigir minúsculas, ausencia de espacios exteriores y valor no vacío. ID interno, relaciones, contraseña excluida y roles mantienen su estructura.

## 4. Base de datos y datos existentes

La prevalidación de todos los usuarios pasó en la base configurada para desarrollo: correos válidos, no vacíos y únicos después de normalizar. Se normalizaron sin inventar valores. Se verificaron el correo único, el CHECK y la ausencia de columna y constraint del identificador anterior. Las relaciones continúan usando id_user. Un correo inválido/null/vacío o duplicado hace fallar la migración antes de cualquier UPDATE o DROP; la transacción revierte sus operaciones. El bloqueo de tabla evita escrituras concurrentes durante la comprobación.

## 5. Migración

`1791763200000-EmailOnlyAuthentication.ts`, aplicada correctamente en desarrollo. No se editó la migración inicial aplicada. PostgreSQL elimina automáticamente el índice/constraint ligado a la columna, sin CASCADE. El único cambio de permisos es desactivar la capacidad obsoleta `user.get-one-by-username`, preservando el registro y sus asociaciones para trazabilidad. No se amplían accesos.

La eliminación no permite reconstruir los identificadores originales: `down` falla explícitamente y exige restaurar un respaldo anterior; no genera valores artificiales. Para otra base: `pnpm --filter medisur-system-backend migration:run`, con respaldo previo y resolución manual de los IDs reportados si falla la prevalidación.

## 6. DTOs

Login exige email válido (máximo 254 caracteres) y password obligatorio. CreateUser y su UpdateUser derivado ya no incluyen nombre de usuario; RegisterPatient tampoco. Una transformación central normaliza el correo. Se conserva el whitelist existente: campos ajenos se descartan, y un login que envía únicamente el identificador anterior se rechaza por faltar email. Las pruebas verifican ambos casos.

## 7. Login backend

La búsqueda exclusiva usa `user.email` normalizado, selección explícita del hash y condición de usuario activo. Se preservan bcrypt, mensaje genérico `Credenciales inválidas`, roles, permisos, sesiones, emisión/renovación y revocación de tokens.

## 8. JWT y sesión

Access token y `/auth/me` omiten el campo eliminado. Refresh conserva idUser y jti. La estrategia sigue consultando la sesión vigente por idUser/idSession y recargando capacidades actuales. No se utiliza correo como clave de relaciones ni hay fallback al identificador anterior.

## 9. Frontend

Login muestra Correo electrónico y Contraseña, valida formato y envía solo email/password normalizados. Se actualizaron tipos, menú de usuario y servicio HTTP. Se retiraron referencias de los ejemplos de tabla y formulario de Materio, manteniendo el correo y el diseño existentes.

## 10. Registro de pacientes

El formulario y el payload requieren nombres, apellidos, correo, documento y contraseña. Backend asigna únicamente PATIENT. No se solicita ni genera nombre de usuario. Después del éxito se guarda solo `{ success: true, email }`, se consume una vez al llegar al login y la contraseña permanece vacía. No se inicia sesión automáticamente.

## 11. Administración y búsqueda

Se retiró el campo de formularios, detalles, tabla y payloads administrativos. La tabla conserva su columna de correo sin duplicarla. Confirmación de estado identifica la cuenta por correo. Búsqueda conserva nombre, apellido, email y documento. Se eliminó el endpoint obsoleto de consulta por nombre de usuario. La edición normaliza el correo y comprueba duplicados incluso en cuentas inactivas.

## 12. Seeds

Se eliminó la capacidad obsoleta del catálogo usado por el seed. No existen seeds de usuarios/SUPERADMIN con credenciales en esta implementación: se crean roles y permisos, por lo que no se añadió ningún usuario ni contraseña de ejemplo. Fixtures y mocks se adaptaron a correo.

## 13. Pruebas y verificaciones prácticas

Backend: 26 suites y 156 pruebas exitosas. Incluyen validación de DTO, correos ausentes/incorrectos, login válido, contraseña errónea, correo inexistente, usuario inactivo, registro sin nombre de usuario, creación administrativa, roles seguros, JWT, `/auth/me`, renovación/revocación, edición/búsqueda, normalización y protección de migración ante datos inválidos/duplicados.

Frontend: 15 suites y 99 pruebas exitosas. Cubren campos visibles, formato inválido, payloads de login/registro/administración, tablas y detalles, redirección, correo rellenado, contraseña vacía y doble envío.

PostgreSQL real después de migrar: creación administrativa sin el campo anterior, registro PATIENT, login con mayúsculas y espacios, contraseña errónea, correo inválido/inexistente, edición de email, consulta por email, listado con búsqueda, cuenta inactiva, JWT y sesión vigente. Usuarios y sesiones de esa verificación se revirtieron en una transacción.

Navegador local: se comprobó login y registro sin el campo anterior; email inválido muestra validación; registro real redirige y rellena el correo normalizado dejando contraseña vacía; contraseña incorrecta se rechaza; login correcto llega al dashboard; desactivar la cuenta revoca el acceso y vuelve a rechazar login. Se eliminó exclusivamente la cuenta temporal y sus sesiones/asociaciones al terminar. Con autorización explícita del usuario, se creó una cuenta SUPERADMIN temporal y se verificaron manualmente en navegador el formulario administrativo sin nombre de usuario, creación con correo en mayúsculas, rol PERSONAL, listado/búsqueda, edición de correo/apellido y detalle sin el campo anterior. Se comprobaron la normalización y conservación del rol. Las cuentas administrativas temporales y sus sesiones/asociaciones se eliminaron al finalizar.

## 14. Referencias restantes

La búsqueda global final no encuentra dependencia funcional. Permanecen referencias en la migración inicial histórica, la nueva migración que elimina la columna/desactiva la capacidad, pruebas negativas que garantizan su ausencia y este informe de auditoría. `identifier` permanece en nombres de paquetes externos del lockfile y comentarios históricos, sin relación con login. No se modificó el lockfile.

## 15. Lint

`pnpm lint`: ambas aplicaciones exitosas.

## 16. Format

`pnpm format`: ambas aplicaciones exitosas. Se formatearon únicamente archivos modificados o añadidos de esta tarea, incluidos cambios locales relacionados.

## 17. Tests

`pnpm test`: ambas aplicaciones exitosas, 255 pruebas en total.

## 18. Build

`pnpm build`: backend y frontend exitosos. Avisos informativos de antigüedad de baseline-browser-mapping y modos SSL de la dependencia PostgreSQL; no se modificaron dependencias ni configuración fuera del alcance. No se ejecutó CI remota, dado que no se publicó ningún cambio.

## 19. Diff y límites

`git diff --check`: exitoso. No se hizo commit, push, PR ni merge. No se agregaron proveedores de identidad, recuperación de contraseña ni cambios de autorización ajenos a retirar la capacidad obsoleta. La recuperación existente/futura puede usar el correo normalizado sin depender del campo eliminado. La reversión de la migración requiere respaldo. Se completaron las verificaciones manuales del flujo público y administrativo en navegador, además de pruebas automatizadas y verificación real de base de datos. No quedan criterios funcionales pendientes de esta tarea.
