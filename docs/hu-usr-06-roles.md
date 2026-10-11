# HU-USR-06 — Gestión administrativa de roles

## Comportamiento

`/dashboard/roles` permite consultar roles, crear roles personalizados, editar descripciones y activar/desactivar roles. Reutiliza `useAuth`, Axios centralizado, `getApiErrorMessage`, estilos de tabla Materio, dialogs, formularios y chips MUI, traducciones de `getRoleLabel` y `ListPagination` de TASK-API-01. Incluye filtros por estado y búsqueda por código o descripción, loading, errores, resultados vacíos, confirmación y feedback.

La autorización depende exclusivamente de los permisos `role.get-all`, `role.create`, `role.update`, `role.delete` y `role.reactivate`, tanto para acciones visibles como para llamadas directas a la API. No hay bypass por nombre del rol del administrador. El SUPERADMIN inicial tiene los permisos explícitos definidos en el catálogo existente.

El modelo actual utiliza `Role.name` como código interno único; no dispone de un campo independiente para un nombre visible editable. Los códigos se conservan en todos los roles existentes. La UI muestra el código original junto a su traducción, sin enviar labels traducidos al backend. Al crear se mantiene la normalización previa: mayúsculas, trim y espacios consecutivos reducidos. Nombre/código admite hasta 100 caracteres, descripción hasta 500.

Los nuevos roles se crean activos y **sin permisos**, reutilizando la lógica de creación existente. La descripción puede editarse también en roles inactivos o base y vaciarse mediante un string vacío. El estado se modifica únicamente en las operaciones autorizadas de activación/desactivación.

Los cuatro roles base del catálogo existente (`SUPERADMIN`, `STAFF`, `DOCTOR`, `PATIENT`) no pueden desactivarse ni cambiar de código. La protección de estos recursos usa `MEDISUR_ROLES`, y no constituye una regla de autorización por rol del actor. Un rol base inactivo proveniente de datos previos puede reactivarse. El endpoint legado PUT también rechaza cambios de código, cerrando esa vía de modificación.

La desactivación de roles personalizados conserva el registro y sus relaciones con usuarios y permisos, incluso si el rol está asignado a usuarios. Conforme a la autenticación existente, un rol inactivo deja de contribuir a las capacidades efectivas en la siguiente petición; reactivarlo restaura las capacidades asociadas que sigan activas. El diálogo advierte este efecto. Se mantienen `createdBy`, `updatedBy` y `deletedBy` según la operación. No se realizan eliminaciones físicas.

El listado muestra cantidad de permisos asociados, sin exponer el arreglo completo en su proyección administrativa. No se muestra cantidad de usuarios: el modelo de consulta actual no ofrece ese dato. No se inventan valores ni se agrega una relación/infrastructura para esta información opcional.

## API y compatibilidad

| Operación | Endpoint | Permiso |
| --- | --- | --- |
| Listado paginado | `GET /api/roles` | `role.get-all` |
| Crear rol administrativo sin permisos | `POST /api/roles` | `role.create` |
| Editar descripción | `PATCH /api/roles/:idRole` | `role.update` |
| Desactivar rol personalizado | `DELETE /api/roles/:idRole` | `role.delete` |
| Reactivar rol | `PATCH /api/roles/reactivate/:idRole` | `role.reactivate` |

`RolesQueryDto` combina `PaginationQueryDto` y `StatusQueryDto`. Parámetros: `page` desde 1 (predeterminado 1), `limit` entre 1 y 100 (predeterminado 10), `status` (`all` por defecto, `active`, `inactive`), y `search` hasta 200 caracteres. La búsqueda es parametrizada y escapa comodines. Se ordena por `idRole` y se utiliza `paginate()` antes de proyectar los registros de la página. No se pagina en memoria.

El envelope existente contiene `data` y `meta: { page, limit, total, totalPages }`. Cada registro administrativo contiene `idRole`, `name`, `description`, `isActive`, `isSystem` y `permissionCount`. El frontend usa `PaginationQuery`, `PaginationMeta` y `PaginatedResponse<T>` existentes.

El listado anteriormente devolvía un arreglo sin metadata. El selector de roles en usuarios mantiene su contrato de arreglo mediante `rolesService.list()`, que recorre páginas de 100 registros usando el cliente existente. La nueva pantalla solicita únicamente la página seleccionada mediante `rolesService.listPage()`.

La creación POST ya no acepta `permissionNames` ni `isActive`. No necesita `role.assign-permissions`, puesto que no asigna capacidades. El PATCH administrativo rechaza `name`, `permissionNames` e `isActive`; únicamente modifica la descripción. No permite alterar permisos ni el estado mediante `role.update`.

Se conservan el endpoint previo de asignación de permisos y el PUT previo con sus permisos específicos, fuera del flujo administrativo nuevo. No se agregaron permisos, se cambiaron relaciones de autorización, se asignaron privilegios clínicos ni se implementó una interfaz para administrar permisos. No hay cambios de entidad, seeds, migraciones, arquitectura, providers, tema o infraestructura.

## Archivos

Backend:

- `apps/api/src/dtos/roles/role-administration.dto.ts` (nuevo).
- `apps/api/src/dtos/roles/roles-query.dto.ts` (nuevo).
- `apps/api/src/dtos/roles/roles.dto.ts` y `role-update.dto.ts` (límites de campos).
- `apps/api/src/services/roles/roles.service.ts` (listado, edición administrativa y protecciones).
- `apps/api/src/controllers/roles/roles.controller.ts` (contratos administrativos y permisos específicos).
- `apps/api/src/services/roles/roles.service.spec.ts`.
- `apps/api/src/controllers/roles/roles.http.spec.ts` (nuevo).
- `apps/api/src/core/guards/permissions/permissions.http.spec.ts`.
- `apps/api/src/controllers/auth/auth.http.spec.ts` (capacidades de roles inactivos/reactivados).

Frontend:

- `apps/web/src/types/roles.ts` (nuevo).
- `apps/web/src/services/roles/rolesService.ts` y `rolesService.test.ts` (prueba nueva).
- `apps/web/src/app/dashboard/roles/page.tsx` (nuevo).
- `apps/web/src/views/roles/RolesAdministration.tsx` (nuevo).
- `apps/web/src/views/roles/RolesAdministration.test.tsx` y `RolesAdministration.interactions.test.tsx` (nuevos).
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx` (enlace por permiso).
- `apps/web/src/services/users/usersService.test.ts` (compatibilidad del selector).

Documentación: este archivo y referencia en `docs/hu-usr-05-roles-permissions.md`.

## Validación

Las pruebas cubren creación válida, duplicados normalizados, edición administrativa, preservación de códigos y permisos, desactivación/reactivación lógica, roles base protegidos incluso mediante API directa, estados de roles y capacidades efectivas, permisos específicos con respuestas 401/403, paginación común, selección completa de roles en usuarios y formularios frontend sin asignación de capacidades.

Checks: `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm build`, TypeScript sin emisión para ambas aplicaciones y `git diff --check`.

Resultados locales del 11 de octubre de 2026: 129 pruebas backend en 24 suites y 65 pruebas frontend en 12 archivos, todas exitosas. Lint, formato, TypeScript y ambos builds pasan, incluyendo `/dashboard/roles`. El build mantiene el aviso previo de datos antiguos de `baseline-browser-mapping`, sin impedir la compilación.

Las pruebas HTTP ejecutan controladores, servicios y guards con repositorios simulados. Las pruebas de interacción frontend reutilizan el patrón de estado/efectos y renderizado del proyecto. No se ejecutó una prueba contra PostgreSQL real ni una validación interactiva del navegador. CI remota pendiente de publicación de la rama.
