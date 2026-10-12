# HU-USR-03: Registro administrativo de pacientes

El registro administrativo utiliza la entidad `User` existente y asigna exclusivamente el rol `PATIENT`. No crea un perfil clínico adicional ni modifica la sesión de quien realiza el alta.

## Acceso y preparación

La pantalla `/dashboard/patients/register` y sus operaciones requieren el permiso `user.create-patient`. La autorización del backend depende de este permiso, no del nombre del rol.

Para incorporar el permiso en una base existente, ejecutar el seed habitual:

```sh
pnpm --filter medisur-system-backend seed
```

El catálogo central lo incorpora a SUPERADMIN. STAFF no recibe permisos automáticamente: un administrador autorizado puede asignarlo mediante la gestión existente de permisos por rol. El rol PATIENT debe existir y estar activo.

## API

| Método | Endpoint                          | Operación                                |
| ------ | --------------------------------- | ---------------------------------------- |
| GET    | `/api/users/patient-registration` | Buscar cuentas existentes antes del alta |
| POST   | `/api/users/patient-registration` | Registrar una cuenta de paciente         |

Ambos endpoints requieren autenticación y `user.create-patient`. Una petición anónima recibe `401`; una cuenta sin el permiso recibe `403`.

La búsqueda requiere `search` con al menos tres caracteres. Reutiliza `UsersQueryDto`, `PaginationQueryDto`, `paginate()` y la consulta paginada de usuarios. Acepta `page`, `limit` y `status`; el límite máximo es 100. La pantalla solicita `status=all` para detectar también cuentas inactivas. Se consultan cuentas de cualquier perfil para identificar coincidencias que impedirían una nueva cuenta. La respuesta contiene `data` y `meta`, con identificación básica, estado e indicador `isPatient`, sin contraseñas ni información de autorización.

El alta recibe únicamente `name`, `lastname`, `email`, `ci` y `password`, mediante el mismo `RegisterPatientDto` del autorregistro. Los campos ajenos al DTO se eliminan mediante la validación existente; el servicio también construye explícitamente los datos permitidos. Roles, permisos, estado y responsable del alta no pueden establecerse desde el cliente.

`UsersService.createPatient()` es compartido por el autorregistro y el registro administrativo. Reutiliza la creación existente, la normalización del correo, la validación de duplicados y el hash de contraseña. Los conflictos de correo o documento producen un error `400` comprensible; si PATIENT no está disponible, se devuelve `503` sin crear la cuenta. Las restricciones únicas de la base siguen protegiendo frente a altas concurrentes.

La cuenta queda activa y puede iniciar sesión mediante el flujo existente. Su identificador y asociación PATIENT quedan disponibles para futuros módulos de citas. `createdBy` registra el identificador del usuario autenticado que realizó el alta, utilizando la infraestructura existente de trazabilidad.

## Interfaz

La pantalla reutiliza Material UI/Materio, el cliente Axios centralizado, `getApiErrorMessage`, las validaciones del formulario de autorregistro y `ListPagination`. Permite búsqueda previa, navegación entre páginas y cambio de tamaño conservando la búsqueda. Muestra estados de carga, vacío, error y éxito, e impide el envío duplicado.

Tras un alta exitosa limpia el formulario y actualiza la búsqueda. Ante un error conserva los datos de identificación y elimina la contraseña introducida. No permite escoger roles ni permisos.

## Archivos modificados

- `apps/api/src/controllers/auth/register.http.spec.ts`
- `apps/api/src/controllers/users/users.controller.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/services/auth/auth.service.ts`
- `apps/api/src/services/users/users.service.spec.ts`
- `apps/api/src/services/users/users.service.ts`
- `apps/web/src/app/dashboard/patients/register/page.tsx`
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx`
- `apps/web/src/services/users/usersService.test.ts`
- `apps/web/src/services/users/usersService.ts`
- `apps/web/src/types/users.ts`
- `apps/web/src/utils/permissionLabels.ts`
- `apps/web/src/views/users/AdministrativePatientRegistration.test.tsx`
- `apps/web/src/views/users/AdministrativePatientRegistration.tsx`
- `docs/hu-usr-03-administrative-patient-registration.md`

## Verificación

Se ejecutaron satisfactoriamente `pnpm test`, `pnpm lint`, `pnpm format` y `pnpm build`: 170 pruebas backend en 27 suites y 115 pruebas frontend en 18 archivos. Las pruebas cubren acceso permitido y denegado, búsqueda paginada, duplicados, validaciones, asignación exclusiva de PATIENT, responsable del alta, autenticación posterior, prevención de doble envío y regresión del autorregistro.

Las pruebas HTTP utilizan Nest, guards y servicios reales con repositorios simulados. No se ejecutó una integración contra PostgreSQL ni la CI remota; esta última requiere publicar los cambios. El seed no se ejecutó contra una base local del usuario. No se añadieron migraciones, dependencias, providers ni cambios al tema o a la arquitectura.
