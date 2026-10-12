# HU-MED-01 — Especialidades médicas

El catálogo se administra en `/dashboard/specialties`. Reutiliza los guards globales, el cliente HTTP, el estilo de tablas y dialogs de Materio y la paginación común de TASK-API-01.

## Modelo y reglas

`specialties` contiene `id_specialty`, `name` (obligatorio, hasta 100 caracteres) y los campos de estado y auditoría de `BaseEntity`. Se recortan los extremos, se colapsan los espacios consecutivos y se capitalizan todas las palabras mediante `formatSpecialtyName`, preservando las tildes introducidas. No se restauran tildes ausentes. El DTO y el servicio reutilizan el helper del backend; el formulario usa su helper local al guardar, sin alterar la escritura. `normalizeSpecialtyNameForComparison` aplica espacios normalizados, minúsculas, Unicode NFD y eliminación de marcas diacríticas exclusivamente para comparación. El servicio compara nombres e identificadores de todos los registros, incluidos inactivos y eliminados lógicamente, y excluye únicamente el identificador editado. Mantiene `BadRequestException` con el mensaje `La especialidad ya existe`. El índice PostgreSQL existente sobre `lower(name)` se conserva: protege concurrencia para diferencias de mayúsculas, pero no garantiza unicidad ante solicitudes simultáneas que difieran en tildes. No se cambia el esquema ni se introducen extensiones. Si se requiere reforzar esa concurrencia, una futura migración puede incorporar una clave normalizada con índice único, después de resolver explícitamente duplicados y definir su sincronización en todos los escritores. Para reutilizar un nombre inactivo se reactiva su registro.

Desactivar conserva el identificador, los datos y la auditoría; no hay eliminación física en la API. Todavía no existen dominios operativos ni relaciones médicas en este repositorio. Las futuras operaciones deben validar la especialidad mediante `SpecialtiesService.getActiveById()` al escribir, para impedir nuevas asociaciones con registros inactivos y conservar las históricas.

## API y permisos

| Método | Ruta                          | Permiso                   | Comportamiento                                |
| ------ | ----------------------------- | ------------------------- | --------------------------------------------- |
| GET    | `/specialties`                | `specialty.get-all`       | Listado paginado; por defecto solo activas    |
| GET    | `/specialties/id/:id`         | `specialty.get-one-by-id` | Consulta administrativa, incluyendo inactivas |
| POST   | `/specialties`                | `specialty.create`        | Crear activa con `{ name }`                   |
| PATCH  | `/specialties/:id`            | `specialty.update`        | Editar nombre con `{ name }`                  |
| DELETE | `/specialties/:id`            | `specialty.delete`        | Desactivar, conservar registro                |
| PATCH  | `/specialties/reactivate/:id` | `specialty.reactivate`    | Reactivar                                     |

El listado usa `page`, `limit`, `status=active|inactive|all` y `search`; devuelve el formato común `{ status, statusCode, data, meta }`. La pantalla administrativa consulta todos los estados y permite filtrarlos. Las consultas operativas deben usar `status=active`.

## Aplicación

Ejecutar `pnpm --filter medisur-system-backend migration:run` para crear la tabla y después `pnpm --filter medisur-system-backend seed` para incorporar los permisos. El seeder existente los asigna a SUPERADMIN; conserva los permisos personalizados, no reactiva capacidades deshabilitadas y no los asigna automáticamente a otros roles. Los usuarios autorizados pueden asignarlos desde la gestión de permisos. Renovar la sesión para obtener las nuevas capacidades.

La migración inversa elimina la tabla; utilizarla únicamente si se pretende descartar sus datos. No se modifica infraestructura ni se ejecuta la migración automáticamente al iniciar la aplicación.

## Revisión de datos existentes

La consulta de solo lectura realizada el 12 de octubre de 2026 encontró tres especialidades y un grupo duplicado conceptual: `id_specialty=1`, `Psicología`, e `id_specialty=2`, `psicologia`. No se eliminaron, fusionaron ni reformatearon registros existentes. La resolución requiere una decisión explícita que preserve relaciones e historial. La edición de un registro hacia el mismo nombre seguirá rechazándose si otro registro también es equivalente; excluir el propio ID no oculta duplicados reales.

La comparación actual recorre los nombres del catálogo para aplicar exactamente la misma normalización Unicode a datos existentes sin migrarlos. Este enfoque es adecuado para el catálogo reducido; una clave normalizada indexada sería preferible si aumenta sustancialmente su volumen.
