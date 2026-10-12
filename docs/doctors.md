# HU-MED-02 — Registrar médico especialista

## Flujo y modelo

En `/dashboard/doctors/register`, el usuario autorizado busca una cuenta por nombre, correo o documento, selecciona una cuenta activa y registra su perfil médico. Los datos obligatorios de identidad y credenciales se validan en el flujo existente de Usuarios. Si la cuenta aún no existe, se crea desde `/dashboard/users` con los permisos vigentes de ese módulo; este registro no crea cuentas ni autentica médicos por separado.

`doctors` tiene una relación uno a uno con `User`, un estado independiente y los campos de auditoría de `BaseEntity`. La cuenta conserva sus datos, contraseña y roles previos. El registro añade únicamente `DOCTOR` si aún no lo tiene, sin duplicarlo. El identificador del médico es único por cuenta, incluso si el perfil está inactivo. Correo y documento siguen sujetos a las restricciones únicas del modelo `User`.

La relación `doctor_specialty` prepara el perfil para una o más especialidades; en este registro su selección es opcional porque la HU no exige asignarlas inicialmente. Solo se aceptan especialidades activas existentes, con IDs únicos y un máximo de 100 asociaciones por solicitud. El catálogo se consulta con el permiso `specialty.get-all` y la paginación común. No se añade edición de datos del médico ni reemplazo de especialidades, que quedan fuera de esta HU.

El registro, la asociación de especialidades y la asignación del rol se ejecutan en una única transacción. Se bloquea la cuenta durante el registro, se validan especialidades con bloqueo de lectura y se garantiza un perfil por usuario mediante una restricción única en PostgreSQL. Una validación o fallo de persistencia aborta todos los cambios de la transacción.

## Estado e integridad

El perfil puede registrarse activo o inactivo. Desactivar conserva la cuenta, el rol y las asociaciones históricas; no implica cerrar la sesión ni desactivar una cuenta que puede tener otros roles. La API no elimina perfiles físicamente. Las claves foráneas restringen la eliminación de usuarios y especialidades relacionados.

El listado `status=active` excluye perfiles inactivos, cuentas inactivas y cuentas sin rol DOCTOR activo; también oculta asociaciones con especialidades inactivas. `status=all` e `inactive` son consultas administrativas. Las futuras operaciones médicas deben resolver el perfil con `DoctorsService.getActiveById()` y validar la especialidad activa al escribir. Los módulos de horarios y citas todavía no existen; no se implementan aquí. Reactivar un perfil exige una cuenta activa, no modifica sus roles y no reactiva sus especialidades.

## API y permisos

| Método | Ruta                          | Permiso             | Datos                                                                                    |
| ------ | ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/doctors`                    | `doctor.get-all`    | `page`, `limit`, `status=active                                                          | inactive | all`, `search`; activo por defecto |
| GET    | `/doctors/registration-users` | `doctor.create`     | Paginación común y búsqueda de al menos 3 caracteres; solo identidad y estado de cuentas |
| POST   | `/doctors`                    | `doctor.create`     | `{ idUser, isActive?: true, specialtyIds?: [] }`                                         |
| DELETE | `/doctors/:id`                | `doctor.delete`     | Desactivar perfil y registrar autor                                                      |
| PATCH  | `/doctors/reactivate/:id`     | `doctor.reactivate` | Reactivar perfil y registrar autor                                                       |

Los guards de autenticación y permisos son los existentes. El registro no permite elegir otros roles ni modificar la identidad de la cuenta. El autor se toma de la sesión, no del cuerpo. Las respuestas proyectan los datos administrativos necesarios y no exponen credenciales ni permisos internos. Todos los listados usan `PaginationQueryDto`, `paginate()`, los tipos comunes de paginación y `ListPagination`.

El seeder asigna el catálogo administrativo a SUPERADMIN. STAFF recibe solo `doctor.create`, `doctor.get-all` y `specialty.get-all` para este flujo. Desactivación y reactivación requieren asignaciones explícitas adicionales. Se conservan permisos personalizados y capacidades deshabilitadas. Las comprobaciones del backend dependen de permisos, no de nombres de roles administrativos.

## Aplicación y validación

Ejecutar `pnpm --filter medisur-system-backend migration:run` para aplicar `CreateDoctors1791810000000`, después `pnpm --filter medisur-system-backend seed` para incorporar permisos. Renovar la sesión para obtener los nuevos permisos. La migración presupone HU-MED-01 aplicada. Su reversión elimina perfiles y asociaciones; usarla solo cuando se quiera descartar esos datos.

Las pruebas cubren autorización HTTP, DTOs, creación con múltiples especialidades, duplicados, preservación de roles, uso de repositorios transaccionales, propagación de fallos para rollback, estado activo/inactivo, exclusión operativa, paginación, datos expuestos y comportamiento del formulario. Los tests unitarios no sustituyen la aplicación y verificación de la migración en una instancia PostgreSQL del entorno.
