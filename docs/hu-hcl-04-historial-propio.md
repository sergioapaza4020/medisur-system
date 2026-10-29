# HU-HCL-04 — Consultar historial clínico propio

## Contrato y autorización

`GET /api/medical-records/mine?page=1&limit=10` requiere sesión vigente y `medical-record.get-mine`. No admite identificadores de paciente o historial en la ruta. El controlador utiliza exclusivamente `CurrentUser.idUser`, y el DTO común descarta parámetros extra como `idPatient`, `idUser`, `idDoctor` o `idMedicalRecord`.

El servicio valida la cuenta activa y no eliminada, obtiene el historial cuyo `id_patient` coincide con el usuario de la sesión y aplica ese mismo predicado antes de paginar y contar. No existe una ruta `/mine/:idPatient`. El control de propiedad se aplica en backend sin depender de lo que muestre la interfaz.

El seed incorpora el permiso al catálogo clínico y lo concede por defecto únicamente a PATIENT. SUPERADMIN no lo recibe automáticamente, tampoco STAFF ni DOCTOR. Se conservan las asignaciones explícitas y capacidades desactivadas de la infraestructura existente. Una concesión explícita a otro rol sigue permitiendo solo la consulta del historial de la propia cuenta, nunca acceso general. El permiso médico `medical-record.get-by-appointment` y el nuevo permiso propio son independientes.

No se exige una cita ni un perfil médico para consultar el historial propio. Un historial todavía inexistente se representa como página vacía y no se crea durante la lectura. Un historial inactivo o eliminado lógicamente se deniega. La lectura no modifica ni elimina información clínica.

## Datos visibles y reutilización

La respuesta conserva el envelope existente con `data` y `meta`. Cada atención contiene exclusivamente:

- `occurredAt`.
- `summary`.
- `doctor: { name, lastname }`.
- `specialty: { name }`.

La proyección para paciente omite incluso `idEncounter`; no devuelve identificadores de paciente, cuenta, médico, historial o cita, credenciales, documentos, correo, roles, permisos ni auditoría interna. Se muestran el resumen y los datos de atención actualmente definidos por el modelo; no se inventan campos clínicos adicionales.

Se comparte la consulta clínica existente con HU-HCL-03 mediante métodos privados de búsqueda del historial y paginación de atenciones. La autorización médica y su constancia de acceso se mantienen en el flujo médico; el paciente no necesita ni recibe esas capacidades. No se adapta artificialmente la tabla de accesos médicos, que exige médico y cita, para registrar una consulta propia. Esta HU no cambia entidades, migraciones ni el alcance de auditoría de HU-HCL-03.

Solo se muestran el historial y las atenciones activos y no eliminados. Las etiquetas de médicos y especialidades históricos se conservan aunque sus perfiles estén inactivos o eliminados lógicamente. El orden es `occurredAt DESC, idEncounter DESC`, de más reciente a más antiguo, con desempate estable. Se reutilizan `PaginationQueryDto`, `PaginatedResult<T>` y `paginate()` de TASK-API-01 sin crear alternativas.

La respuesta usa `Cache-Control: no-store`. No se añade logging de contenido clínico ni se transportan resúmenes en parámetros de URL.

## Frontend

`/dashboard/medical-records` muestra **Mi historial clínico** dentro del layout existente. El enlace del menú y la vista requieren `medical-record.get-mine`. La página no presenta campos para elegir a otro paciente y el cliente HTTP solo envía la paginación.

La vista reutiliza `PaginationQuery`, `PaginationMeta`, `PaginatedResponse<T>` y `ListPagination`. Presenta carga, historial vacío, errores recuperables con reintento y acceso denegado. Permite actualizar el historial, limpia visualmente la página anterior durante una nueva solicitud y ajusta la página cuando dejan de existir resultados.

El estado se aísla por cuenta; cambios de cuenta o permiso ocultan inmediatamente el contenido anterior. Las respuestas tardías se descartan al cambiar de contexto o salir de la vista. Los resúmenes se renderizan como texto escapado, sin interpretación de HTML ni almacenamiento persistente en navegador. Las fechas y horas se muestran en `America/La_Paz`.

No se modifican tema, providers, arquitectura ni infraestructura.

## Despliegue

No se necesita una nueva migración. Ejecutar `pnpm --filter medisur-system-backend seed` en el entorno de destino para incorporar el permiso y actualizar la sesión/interfaz cuando corresponda. Esta entrega no ejecuta el seed ni modifica datos de la base de la aplicación.

## Pruebas

- Servicio: alcance por usuario, proyección sin IDs, paginación, cuenta inválida/inactiva, historial vacío o no disponible, y ausencia de dependencia de médico/cita.
- HTTP: 401/403, permisos específicos independientes, revocación efectiva, parámetros de identidad manipulados descartados, ausencia de ruta con identificador ajeno, DTO común de paginación y cabecera sin caché.
- PostgreSQL: dos pacientes y varios médicos, aislamiento de atenciones y totales, orden y desempates, páginas vacías, cuentas e historiales inactivos/eliminados, lectura sin citas y conservación de etiquetas históricas. Las suites previas verifican además que el flujo médico y sus constancias de acceso mantienen su comportamiento.
- Frontend: permisos, sesión, carga, vacío, reintento, denegación, paginación compartida, actualización, cambios de cuenta, respuestas tardías, errores después de una página anterior y escape de HTML.

Las pruebas reales usan `APPOINTMENTS_TEST_DATABASE_URL` con esquemas temporales aislados, nunca `DATABASE_URL`.

## Archivos de la HU

Nuevos:

- `apps/api/src/common/types/patient-medical-record.type.ts`.
- `apps/web/src/app/dashboard/medical-records/page.tsx`.
- `apps/web/src/views/medical-records/MyMedicalRecord.tsx`.
- `apps/web/src/views/medical-records/MyMedicalRecord.test.tsx`.
- Este documento.

Actualizados:

- `apps/api/src/controllers/medical-records/medical-records.controller.ts`.
- `apps/api/src/controllers/medical-records/medical-records.http.spec.ts`.
- `apps/api/src/services/medical-records/medical-records.service.ts`.
- `apps/api/src/services/medical-records/medical-records.service.spec.ts`.
- `apps/api/src/services/medical-records/medical-records.postgres.spec.ts`.
- `apps/api/src/database/seeders/access-control.catalog.ts`.
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`.
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx`.
- `apps/web/src/services/medical-records/medicalRecordsService.ts`.
- `apps/web/src/services/medical-records/medicalRecordsService.test.ts`.
- `apps/web/src/types/medical-records.ts`.
- `apps/web/src/utils/permissionLabels.ts`.

## Verificación de la entrega

- Rama utilizada: `feat/hu-hcl-04`; no se crearon ramas ni commits.
- `pnpm lint`: correcto en backend y frontend.
- `pnpm format`: correcto en ambas aplicaciones.
- `pnpm build`: correcto en ambas aplicaciones, incluida la nueva ruta. Permanece el aviso previo de `baseline-browser-mapping` sin afectar la compilación.
- `pnpm --filter medisur-system-backend exec jest --runInBand --cacheDirectory node_modules/.cache/jest`, con `APPOINTMENTS_TEST_DATABASE_URL` apuntando a PostgreSQL 16 temporal: 63 suites y 834 pruebas aprobadas, sin omisiones. Incluye la regresión de citas, atenciones, consulta médica y la nueva consulta propia.
- `pnpm --filter medisur-system-frontend test`: 52 archivos y 420 pruebas aprobadas.
- `git diff --check`: correcto.
- La instancia PostgreSQL temporal se detuvo al finalizar. No se aplicaron migraciones ni seeds sobre la base de la aplicación.
- Pendientes de despliegue: ejecutar el seed del nuevo permiso y verificar CI remoto al publicar los cambios. No se requiere una migración nueva. No hay criterios funcionales pendientes conocidos ni desviaciones hacia accesos extraordinarios u otras historias.
