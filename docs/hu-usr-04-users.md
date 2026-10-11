# HU-USR-04 — Administración de usuarios

## Comportamiento

La ruta protegida `/dashboard/users` reutiliza el guard de autenticación, `useAuth`, el cliente Axios centralizado, el manejo de errores de API y el estilo de tablas de Materio. Permite consultar usuarios, filtrar por estado y buscar por nombre, apellido, usuario, correo o documento. Muestra los roles activos y el estado de cada cuenta.

Las acciones de detalle, creación, edición, desactivación y reactivación dependen de permisos específicos. El backend valida estos permisos incluso en llamadas directas. No existe un bypass por nombre de rol.

Crear requiere los permisos existentes `user.create` y `user.assign-roles`. El formulario exige seleccionar explícitamente al menos un rol y permite múltiples roles activos. Si el administrador tiene `role.get-all`, carga las opciones del catálogo existente. De lo contrario permite introducir nombres de roles, que el backend valida; no realiza una consulta al catálogo sin permiso. Editar datos no permite modificar roles ni el estado por medio del DTO de actualización.

La edición administrativa tampoco permite modificar contraseñas: `UserUpdateDto`
excluye `password` y rechaza colecciones `roleNames`, y el servicio solo actualiza los campos administrativos
explícitos. La política global de validación ignora campos fuera del contrato, incluido
`password` enviado manualmente. Creación y edición reutilizan el mismo formulario;
solo creación mantiene contraseña inicial obligatoria. Ambos modos incluyen roles. Al abrir edición o
cerrar el formulario se eliminan las credenciales del estado. No se incorporan nuevos
flujos de cambio o recuperación: requieren futuras HUs de autenticación.

Las respuestas respetan la exclusión existente del hash de contraseña y ahora también
la del hash de refresh token almacenado en `UserSession`, incluidas las respuestas de
administración de sesiones. Los tokens emitidos por login/renovación se mantienen en
sus endpoints de autenticación; no son credenciales recuperadas de otro usuario.

La desactivación conserva al usuario y sus relaciones. Se registra el autor autenticado en los campos existentes `createdBy`, `updatedBy` y `deletedBy`, según la operación. No requiere migraciones, nuevos permisos ni cambios de seeds.

Ningún usuario puede desactivar su propia cuenta. El listado compara `useAuth().user.idUser`
(sesión cargada mediante `/auth/me`) con el ID de la fila: muestra Desactivar deshabilitado
con una explicación y bloquea la apertura y ejecución de la confirmación. El servicio
`UsersService.delete` compara el destino con el autor recibido mediante `@CurrentUser()`
y rechaza la auto-desactivación con HTTP 400 y el mensaje
`No puedes desactivar tu propia cuenta`, antes de consultar o guardar cambios.
La reactivación no está sujeta a esta restricción. No existe una protección específica
del último SUPERADMIN; esa regla queda fuera del alcance de este cambio.

La autenticación existente continúa buscando únicamente usuarios activos. Las pruebas de autenticación verifican que una cuenta inactiva no puede iniciar sesión ni utilizar access/refresh tokens anteriores mientras permanece inactiva.

## API

| Operación                             | Endpoint                              | Permiso                             |
| ------------------------------------- | ------------------------------------- | ----------------------------------- |
| Lista                                 | `GET /api/users`                      | `user.get-all`                      |
| Detalle, incluyendo cuentas inactivas | `GET /api/users/id/:idUser`           | `user.get-one-by-id`                |
| Crear                                 | `POST /api/users`                     | `user.create` y `user.assign-roles` |
| Actualizar datos                      | `PATCH /api/users/:idUser`            | `user.update`                       |
| Desactivar, conservando el registro   | `DELETE /api/users/:idUser`           | `user.delete`                       |
| Reactivar                             | `PATCH /api/users/reactivate/:idUser` | `user.reactivate`                   |
| Reemplazar roles (mínimo uno)         | `PUT /api/users/assign-roles/:idUser` | `user.assign-roles`                 |

La edición reutiliza el selector de roles de creación, precargado con las asociaciones
actuales. `PUT /users/assign-roles/:idUser` reutiliza `UsersAssignRolesDto` y el servicio
existente en modo reemplazo; permite quitar roles conservando al menos uno.
`PATCH` sobre la misma ruta conserva la operación anterior de agregar roles.
Solo se pueden otorgar nuevos roles activos; asociaciones inactivas existentes pueden
conservarse o retirarse. Se admiten usuarios inactivos en el reemplazo administrativo.
El frontend guarda datos y roles por separado, informa fallos parciales y no solicita
el reemplazo si la selección no cambió o no existe `user.assign-roles`.

El selector muestra `Roles (obligatorio)` y un texto auxiliar explícito. Una selección
vacía muestra error y bloquea Guardar. Los DTOs de creación y asignación aplican
`ArrayMinSize(1)`; el servicio valida la colección antes de guardar. Actualizar datos
sin enviar roles conserva las asociaciones actuales. No se eliminan roles al desactivar.
Las cuentas antiguas sin roles requieren una selección explícita antes de guardar:
el formulario asigna esos roles antes de actualizar datos. El servicio también impide
actualizar o reactivar cuentas sin roles. No se asigna PATIENT automáticamente ni se
modifica el autoregistro.

`GET /api/users` mantiene el arreglo en `data` y agrega `meta: { page, limit, total, totalPages }` al envelope existente.

- `page`: entero desde 1; predeterminado 1.
- `limit`: entero entre 1 y 100; predeterminado 10.
- `status`: `active`, `inactive` o `all`; reutiliza `StatusQueryDto`, con `active` por defecto. La pantalla administrativa solicita `all` inicialmente.
- `search`: texto opcional de hasta 200 caracteres. Se parametriza y se escapan comodines para una búsqueda literal parcial, sin distinguir mayúsculas.

La consulta anteriormente devolvía todos los registros sin paginación. Los consumidores que necesiten recorrer la lista deben solicitar sus páginas. No se encontró un paginador funcional previo; se completó la consulta existente `getManyAndCount` mediante `skip`/`take` y se utilizó `TablePagination` de MUI con el tema ya configurado.

El detalle administrativo no modifica `UsersService.getOneById`, que conserva la restricción de usuario activo para autenticación. Email, username y documento se validan contra registros existentes, incluidos los inactivos. Las restricciones únicas existentes mantienen la integridad en la base de datos. Contraseñas continúan cifradas con bcrypt y excluidas de las respuestas.

## Archivos

- Backend: `controllers/users/users.controller.ts`, `services/users/users.service.ts`, `dtos/users/users.dto.ts`, nuevo `dtos/users/users-query.dto.ts`.
- Frontend: nueva ruta `app/dashboard/users/page.tsx`, `views/users/UsersAdministration.tsx`, `types/users.ts`, `services/users/usersService.ts`, `services/roles/rolesService.ts`, y enlace autorizado en `components/layout/vertical/VerticalMenu.tsx`.
- Pruebas: `services/users/users.service.spec.ts`, `core/guards/permissions/permissions.http.spec.ts`, nuevos `services/users/usersService.test.ts` y `views/users/UsersAdministration.test.tsx`.

## Validación

Se ejecutan los scripts del repositorio `pnpm test`, `pnpm lint`, `pnpm format` y `pnpm build`, además de TypeScript sin emisión para ambas aplicaciones y `git diff --check`.

Resultados locales del 9 de octubre de 2026: 68 pruebas backend en 21 suites y 17 pruebas frontend en 5 archivos, todas exitosas. Lint y formato pasan. Builds de NestJS y Next.js pasan, incluyendo `/dashboard/users`. Los chequeos de tipos y diferencias pasan. El build conserva el aviso de datos antiguos de `baseline-browser-mapping`; no impide compilar y no se cambiaron dependencias por esta historia.

Las pruebas cubren paginación y filtros, credenciales cifradas, identidades duplicadas, roles inválidos, actualización limitada a campos permitidos, auditoría, cuentas inactivas, desactivación sin eliminación, controles visuales por permiso y acceso directo a los endpoints con respuestas 401/403. Se conserva la suite de regresión de autenticación y autorización.

Las pruebas de servicios utilizan repositorios simulados; no se ejecutó una prueba contra PostgreSQL real ni una validación interactiva del navegador. La CI de GitHub queda pendiente de publicar la rama y ejecutar el workflow. No se modificaron arquitectura, providers, tema, infraestructura ni dependencias.
