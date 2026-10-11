# HU-USR-07 — Permisos por rol

La pantalla `/dashboard/roles/permissions` consulta el catálogo real, agrupa por dominio y permite seleccionar múltiples cambios y guardarlos en una sola operación. La selección se conserva entre páginas. Los nombres internos no se traducen: únicamente los labels visuales. No hay controles para crear, editar o eliminar permisos del catálogo.

## API y autorización

- `GET /api/roles/id/:idRole`: requiere `role.get-one-by-id`; incluye las asociaciones actuales, también para roles inactivos. Un identificador inexistente devuelve 400 conforme al patrón existente.
- `GET /api/permissions?page=1&limit=10&status=all`: requiere `permission.get-all`; ahora devuelve la estructura paginada común `{data, meta}` dentro del envelope existente. El estado predeterminado sigue siendo `active`. Límite máximo: 100. La consulta utiliza `paginate()` en TypeORM.
- `PUT /api/roles/assign-permissions/:idRole`: requiere `role.assign-permissions`; body `{ "permissionNames": ["user.get-all"] }`. Reemplaza las asociaciones completas; `[]` retira todas. Reutiliza el DTO y servicio de asignación. El PATCH existente conserva su comportamiento aditivo.

Para acceder a la pantalla se requieren `role.get-all`, `role.get-one-by-id` y `permission.get-all`. El permiso adicional `role.assign-permissions` habilita los controles de guardado. Las comprobaciones frontend se complementan con los guards existentes del backend.

Todas las entradas se validan antes del único `Repository.save`, que guarda las relaciones mediante la transacción predeterminada de TypeORM. No se crean permisos y no se alteran códigos ni descripciones de roles. Se rechazan duplicados por HTTP y permisos desconocidos o nuevos permisos inactivos. Las asociaciones inactivas existentes pueden conservarse o retirarse sin reactivar su capacidad. Se debe reactivar un rol inactivo antes de modificar sus asociaciones.

La autorización sigue leyendo los permisos efectivos desde la sesión y la base de datos en cada petición. El nombre SUPERADMIN no concede acceso implícito, clínico ni administrativo. No existen permisos clínicos implementados en el catálogo inicial; sus restricciones deben definirse en las historias clínicas correspondientes. El modelo existente permite a quien posee `role.assign-permissions` administrar las asociaciones del catálogo, sin una restricción adicional por subconjunto de permisos propios. Esta historia conserva esa política, incluyendo la posibilidad de retirar el acceso administrativo propio.

## Archivos de implementación y validación

- Backend: controladores de roles/permisos, servicios de roles/permisos y `dtos/permissions/permissions-query.dto.ts`.
- Frontend: ruta y vista de permisos por rol, navegación vertical, servicios de roles/permisos, tipos de permisos y vocabulario de labels.
- Pruebas: servicio de roles, paginación del catálogo, HTTP de roles y guards; servicios HTTP frontend e interacciones de la pantalla.

Las pruebas HTTP utilizan Nest y los guards reales con repositorios simulados; no sustituyen una ejecución contra PostgreSQL. La CI remota requiere publicar la rama.

### Archivos modificados o añadidos

```text
apps/api/src/controllers/auth/auth.http.spec.ts
apps/api/src/controllers/permissions/permissions.controller.ts
apps/api/src/controllers/roles/roles.controller.ts
apps/api/src/controllers/roles/roles.http.spec.ts
apps/api/src/core/guards/permissions/permissions.http.spec.ts
apps/api/src/dtos/permissions/permissions-query.dto.ts
apps/api/src/services/permissions/permissions-pagination.spec.ts
apps/api/src/services/permissions/permissions.service.ts
apps/api/src/services/roles/roles.service.spec.ts
apps/api/src/services/roles/roles.service.ts
apps/web/src/app/dashboard/roles/permissions/page.tsx
apps/web/src/components/layout/vertical/VerticalMenu.tsx
apps/web/src/services/permissions/permissionsService.test.ts
apps/web/src/services/permissions/permissionsService.ts
apps/web/src/services/roles/rolesService.test.ts
apps/web/src/services/roles/rolesService.ts
apps/web/src/types/permissions.ts
apps/web/src/utils/permissionLabels.ts
apps/web/src/views/roles/RolePermissionsAdministration.test.tsx
apps/web/src/views/roles/RolePermissionsAdministration.tsx
docs/hu-usr-07-role-permissions.md
```

### Checks locales

- `pnpm lint`: ambas aplicaciones exitosas.
- `pnpm format`: ambas aplicaciones exitosas.
- `pnpm test`: 137 pruebas backend en 25 suites y 74 frontend en 14 archivos, todas exitosas.
- `pnpm build`: backend y frontend exitosos; nueva ruta incluida.
- `pnpm --filter medisur-system-frontend exec tsc --noEmit`: exitoso.
- `git diff --check`: exitoso.

Se verifican asociaciones múltiples, retiro total, validación de permisos y duplicados, persistencia por HTTP, 401/403, cambios efectivos sobre una sesión existente, ausencia de privilegios implícitos por SUPERADMIN, roles y permisos inactivos, selección de rol, paginación sin perder la selección, estados vacíos, carga, errores y bloqueo de doble envío. El build mantiene el aviso preexistente de datos antiguos en `baseline-browser-mapping`, sin afectar su resultado.
