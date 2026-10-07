# HU-USR-05: roles y permisos MEDISUR

## Inventario y decisiones

Se conservan las entidades User, Role y Permission, sus relaciones muchos a muchos,
las tablas user_role y role_permission, los guards globales, Passport/JWT y los endpoints
existentes. Las tablas intermedias ya tienen claves primarias compuestas que impiden
asignaciones duplicadas; no se requiere una migración de estructura.

El repositorio no contenía un catálogo ni un seed funcional de roles/permisos. Los
controladores actuales usan la convención singular recurso.acción. Se conserva esa
nomenclatura y se incluyen únicamente usuarios, roles, permisos y sesiones existentes.
No se agregan permisos clínicos ni de módulos futuros.

El frontend contiene la plantilla Materio y un login de demostración; no existe
administración de roles/permisos, sesión autenticada ni componentes de permisos que
adaptar. Esta HU permite gestionar y consultar la configuración mediante la API REST
existente. Una interfaz y la integración de login corresponden a sus propias historias.
No se cambiaron tema, providers ni infraestructura.

## Catálogo inicial

El catálogo ejecutable está en
apps/api/src/database/seeders/access-control.catalog.ts.

| Recurso    | Acciones                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| user       | get-all, get-one-by-email, get-one-by-username, get-one-by-id, create, update, delete, reactivate, assign-roles |
| role       | get-all, get-one-by-name, get-one-by-id, create, update, delete, reactivate, assign-permissions                 |
| permission | get-all, get-one-by-name, get-one-by-id, create, update, delete, reactivate                                     |
| session    | get-all, revoke-one, revoke-all                                                                                 |

Cada permiso es recurso.acción, por ejemplo role.assign-permissions. Las acciones
delete conservan la desactivación lógica existente.

| Rol inicial | Permisos al crearse mediante seed                             |
| ----------- | ------------------------------------------------------------- |
| SUPERADMIN  | Los 27 permisos del catálogo inicial explícitamente asignados |
| STAFF       | Ninguno; el administrador asigna lo necesario                 |
| DOCTOR      | Ninguno; las épicas médicas definirán sus capacidades         |
| PATIENT     | Ninguno; las épicas de pacientes definirán sus capacidades    |

Los roles son agrupaciones, nunca bypasses. Un rol personalizado puede compartir
permisos con cualquier otro. SUPERADMIN no otorga capacidades implícitas ni acceso
clínico. El seed conserva roles personalizados y no reasigna ni reactiva capacidades
existentes en ejecuciones posteriores.

Para datos provenientes del dominio anterior, el seed desactiva permisos de los
namespaces académicos explícitos career, course, subject, enrollment y academic,
preservando registros y asociaciones. No borra datos históricos ni desactiva permisos
personalizados de otros dominios. No existen endpoints académicos protegidos en el
código actual. Los fixtures de roles académicos se adaptaron a MEDISUR.

## Reproducción en una base limpia

Con DATABASE_URL configurada en apps/api/.env y dependencias instaladas:

```sh
pnpm --filter medisur-system-backend migration:run
pnpm --filter medisur-system-backend seed
```

El seed ejecuta toda la configuración en una transacción. Se puede repetir sin duplicar
roles, permisos o asociaciones. Los permisos desactivados por el administrador y las
asignaciones existentes se preservan. En una base ya configurada, revisar los permisos
explícitos de SUPERADMIN antes de retirar el bypass de la versión anterior: el seed no
restaura asignaciones a un rol ya existente.

No se crean cuentas ni contraseñas predeterminadas. El operador debe provisionar una
cuenta inicial mediante el mecanismo de instalación y asociarla al rol SUPERADMIN.
Para un usuario ya provisionado, ejecutar con una conexión administrativa y un
parámetro numérico validado, sustituyendo :id_usuario por su identificador:

```sql
INSERT INTO user_role ("usersIdUser", "rolesIdRole")
SELECT id_user, id_role
FROM users CROSS JOIN roles
WHERE id_user = :id_usuario AND roles.name = 'SUPERADMIN'
ON CONFLICT DO NOTHING;
```

## Autorización y gestión

La estrategia JWT verifica el token y consulta el usuario activo con sus roles/permisos
actuales en cada petición. Los permisos efectivos son la unión sin duplicados de los
permisos activos pertenecientes a roles activos. Los cambios y desactivaciones tienen
efecto en la siguiente petición, incluso con un token previamente emitido. Un usuario
inactivo deja de autenticarse.

El guard exige todos los permisos declarados en @Permissions y admite metadatos en
método o controlador. No evalúa nombres de roles. Sin autenticación se responde 401;
sin permisos suficientes, 403, antes de ejecutar la operación.

- GET /roles requiere role.get-all e incluye las asociaciones con permisos.
- GET /permissions requiere permission.get-all; admite el filtro de estado existente.
- POST /roles requiere role.create y role.assign-permissions.
- PUT /roles/:idRole requiere role.update y role.assign-permissions; reemplaza la lista
  completa. Una lista vacía revoca todos los permisos del rol.
- PATCH /roles/assign-permissions/:idRole requiere role.assign-permissions; agrega
  permisos activos y rechaza asociaciones ya existentes.
- POST /users requiere user.create y user.assign-roles porque su DTO incluye roles.
- PATCH /users/assign-roles/:idUser conserva user.assign-roles.
- Los demás endpoints conservan sus permisos específicos existentes.

Las listas de asignación validan cadenas no vacías y elementos únicos. Los servicios
normalizan los nombres de roles y deduplican entradas antes de persistir; validan toda
la asignación antes de modificar la colección. Se conserva la unicidad de nombres
incluso para roles inactivos. Los cambios de roles/permisos registran el actor en los
campos createdBy, updatedBy y deletedBy existentes, sin añadir un módulo de auditoría.

## Verificación

Las pruebas cubren grants/revocaciones con el mismo JWT mediante HTTP real, respuestas
401/403/200, ausencia de bypass SUPERADMIN, permisos de asignación adicionales,
validación de DTOs, roles/permisos inactivos, deduplicación y seed idempotente.
Los servicios de persistencia de las pruebas HTTP son dobles; la estrategia JWT,
los guards, controladores y la validación son reales.

La verificación adicional sobre una instancia PostgreSQL 16 local temporal pasó:
migración inicial en una base limpia, seed repetido, cuatro roles y 27 permisos,
reutilización de permisos en varios roles, revocación efectiva, desactivación de
roles/permisos, limpieza académica y actor persistido. La instancia se detuvo y sus
datos temporales se eliminaron. No se modificó la base remota configurada.

Pendiente de entrega: ejecutar GitHub Actions sobre una instalación limpia con
--frozen-lockfile. El entorno local tiene Next.js 14.2.35 instalado aunque package.json
declara 16.0.4; por tanto, el lint/build local del frontend no demuestra compatibilidad
con la versión declarada. No se modificaron dependencias o infraestructura en esta HU.
El frontend no contiene pruebas y su script termina correctamente con passWithNoTests.

## Archivos de la implementación

- `apps/api/src/controllers/permissions/permissions.controller.ts`
- `apps/api/src/controllers/roles/roles.controller.ts`
- `apps/api/src/controllers/users/users.controller.ts`
- `apps/api/src/core/decorators/permissions/permissions.decorator.ts`
- `apps/api/src/core/guards/permissions/permissions.guard.spec.ts`
- `apps/api/src/core/guards/permissions/permissions.guard.ts`
- `apps/api/src/core/guards/permissions/permissions.http.spec.ts`
- `apps/api/src/core/strategies/jwt/jwt.strategy.spec.ts`
- `apps/api/src/core/strategies/jwt/jwt.strategy.ts`
- `apps/api/src/database/seed.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/database/seeders/access-control.seeder.ts`
- `apps/api/src/dtos/permissions/permissions.dto.ts`
- `apps/api/src/dtos/roles/role-assign-permissions.dto.ts`
- `apps/api/src/dtos/roles/role-update.dto.ts`
- `apps/api/src/dtos/roles/roles.dto.ts`
- `apps/api/src/dtos/users/users-assign-roles.dto.ts`
- `apps/api/src/services/auth/auth.service.spec.ts`
- `apps/api/src/services/auth/auth.service.ts`
- `apps/api/src/services/permissions/permissions.service.ts`
- `apps/api/src/services/roles/roles.service.spec.ts`
- `apps/api/src/services/roles/roles.service.ts`
- `apps/api/src/services/users/users.service.spec.ts`
- `apps/api/src/services/users/users.service.ts`
- `docs/hu-usr-05-roles-permissions.md`

## Hallazgo fuera del alcance

UsersService.getAll conserva un join a user.careers, pero la entidad User actual no
contiene esa relación. La consulta de usuarios requiere una corrección propia; se
propone una Issue enfocada en eliminar esa referencia académica y probar el listado
con persistencia real. No se modificó ese flujo en HU-USR-05, que trata la configuración
de roles/permisos y su autorización.

## Resultados locales

- Backend: lint sin errores; 20 suites y 46 pruebas exitosas, incluidas llamadas HTTP directas.
- Tipos del backend y de sus pruebas: correctos con tsc --noEmit.
- Build de backend y frontend: exitosos.
- Formato de ambas aplicaciones: correcto.
- Frontend: lint sin errores, pruebas sin archivos de test.
- PostgreSQL 16 temporal: migración inicial y seed repetido verificados.
- GitHub Actions e instalación congelada: pendientes; no se publicó una rama ni PR.
