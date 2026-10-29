# HU-HCL-03 — Consultar historial clínico como médico

## Regla de autorización

`GET /api/medical-records/by-appointment/:idAppointment?page=1&limit=10` requiere sesión vigente, el permiso clínico `medical-record.get-by-appointment` y el perfil médico activo de la cuenta autenticada, mediante `SchedulesService.ownDoctor`.

La cita debe pertenecer al médico de la sesión, estar activa, no eliminada lógicamente y tener estado `RESERVED`. El paciente vinculado debe estar activo y no eliminado lógicamente. No se aceptan identidades de médico, paciente, historial o actor enviadas en los parámetros de consulta. Citas inexistentes, ajenas, canceladas, reprogramadas, desactivadas o eliminadas no habilitan la consulta y reciben la misma denegación genérica (403), sin revelar si existe un historial.

La relación asistencial se define por la cita reservada, sin introducir una ventana temporal que no esté especificada por el proyecto: se permiten citas reservadas futuras o pasadas mientras conserven ese estado. La cancelación o reprogramación retira el acceso a través de esa cita; una nueva cita válida puede constituir otra relación asistencial. No se conceden accesos generales por nombre de rol.

El seed asigna el permiso a DOCTOR y lo clasifica como clínico, excluyéndolo de las concesiones automáticas a SUPERADMIN. STAFF y PATIENT tampoco lo reciben. La política previa de conservar concesiones explícitas y capacidades desactivadas se mantiene. Una concesión explícita no sustituye la comprobación de perfil médico y cita propia.

## Información consultable y paginación

La consulta obtiene el historial general del paciente de la cita, incluidas atenciones realizadas por otros médicos/especialidades. Solo muestra el historial activo y no eliminado, y sus atenciones activas y no eliminadas. Conserva los nombres del médico y la especialidad de atenciones históricas aunque sus registros actuales estén desactivados o eliminados lógicamente. Esta consulta no altera ni elimina esas relaciones.

Cada atención se proyecta exclusivamente como `idEncounter`, `occurredAt`, `summary`, `doctor: { name, lastname }` y `specialty: { name }`. No se devuelven identificadores de cuentas/paciente/historial, correo, documento, credenciales, roles, permisos, auditoría interna ni datos administrativos de citas. El resumen se selecciona explícitamente solo en esta consulta autorizada; su exclusión predeterminada en TypeORM permanece intacta.

Se reutilizan `PaginationQueryDto`, `PaginatedResult<T>` y `paginate()`. El alcance por historial y paciente se aplica antes de paginar y contar. Se ordena por `occurredAt DESC, idEncounter DESC`. Un historial todavía inexistente produce una página vacía válida sin crearlo. Un historial inactivo o eliminado se deniega. No se crean DTOs ni helpers de paginación nuevos.

La respuesta conserva el envelope existente con `data` y `meta`, y establece `Cache-Control: no-store`. No se registra contenido clínico en logs ni en parámetros de URL.

## Contexto durable para auditoría

La migración `1793318400000-MedicalRecordAccesses` crea `medical_record_accesses`, una constancia mínima de lectura clínica: actor, paciente, médico, cita que autorizó el acceso, historial si existe y fecha/hora. La tabla representa exclusivamente lecturas ordinarias mediante cita; no contiene resúmenes ni copias del historial, y no tiene endpoints de edición, borrado o consulta.

Cada petición autorizada, incluida una página vacía, conserva una constancia. Las comprobaciones, la lectura paginada y la escritura del acceso se ejecutan en la misma transacción. Se toman bloqueos de lectura del médico, cita, paciente e historial, respetando el orden médico antes de cita usado por el sistema. Si no se puede guardar la constancia, la petición falla sin entregar el contenido clínico. Los accesos denegados no generan una constancia de lectura autorizada.

Las relaciones usan `ON DELETE RESTRICT` para conservar trazabilidad. La eliminación lógica de entidades referenciadas no borra eventos. La integración de estas constancias con la bitácora transversal corresponde a EPIC-09; esta HU no implementa dicha bitácora ni accesos extraordinarios.

## Frontend

El detalle de una cita en la agenda incorpora `Consultar historial`. Se muestra únicamente con el permiso clínico y una cita `RESERVED` cuya elegibilidad haya confirmado el backend mediante `canReadMedicalRecord`. La agenda calcula esa señal con el estado de la cita y del paciente sin exponer los campos internos utilizados. El backend vuelve a comprobar toda la autorización al consultar; la señal no constituye una concesión de acceso.

El diálogo muestra paciente, atenciones, fechas/horas de Bolivia y la paginación común `PaginationQuery`, `PaginationMeta`, `PaginatedResponse<T>` y `ListPagination`. Maneja carga, historial vacío, acceso denegado y errores recuperables. No muestra datos de la página anterior durante una petición. Descarta respuestas obsoletas, limpia el contenido al cerrar, vuelve a consultar al abrir y aísla el estado por cuenta y cita. Los resúmenes se renderizan como texto y no se guardan en almacenamiento local ni se transportan en URL.

No se cambian el tema, los providers, la navegación global ni la infraestructura. Los servicios y el controlador de consulta se registran en el módulo clínico existente `EncountersModule`, que ya contiene las entidades de historial y atenciones.

## Instalación y alcance

Aplicar la migración con `pnpm --filter medisur-system-backend migration:run` y actualizar permisos con `pnpm --filter medisur-system-backend seed`; actualizar la sesión si corresponde. No se aplica esta migración a la base de la aplicación como parte de las pruebas. La reversión elimina las constancias de acceso: no revertir en un entorno con trazabilidad que deba conservarse sin respaldo y decisión explícita.

Esta historia no agrega consulta propia del paciente, concesión extraordinaria, modificación de historiales ni reportes. Esas operaciones continúan fuera del alcance.

## Pruebas y archivos

Las pruebas incluyen autenticación/permisos HTTP, descarte de identificadores manipulados, paginación común y cabecera sin caché; autorización y proyección SQL; PostgreSQL con dos médicos/pacientes, estados inválidos, historial vacío, orden y totales aislados, autores históricos, constancias mínimas y fallo cerrado ante error de auditoría; y frontend con estados, permisos, elegibilidad, paginación, cambio de contexto, respuestas tardías, reapertura y escape de HTML.

Las pruebas PostgreSQL usan `APPOINTMENTS_TEST_DATABASE_URL` con esquemas temporales y nunca usan `DATABASE_URL`.

Archivos incorporados:

- `apps/api/src/common/types/doctor-medical-record.type.ts`
- `apps/api/src/controllers/medical-records/medical-records.controller.ts`
- `apps/api/src/controllers/medical-records/medical-records.http.spec.ts`
- `apps/api/src/services/medical-records/medical-records.service.ts`
- `apps/api/src/services/medical-records/medical-records.service.spec.ts`
- `apps/api/src/services/medical-records/medical-records.postgres.spec.ts`
- `apps/api/src/entities/medical-records/medical-record-access.entity.ts`
- `apps/api/src/database/migrations/1793318400000-MedicalRecordAccesses.ts`
- `apps/web/src/types/medical-records.ts`
- `apps/web/src/services/medical-records/medicalRecordsService.ts`
- `apps/web/src/services/medical-records/medicalRecordsService.test.ts`
- `apps/web/src/views/appointments/DoctorMedicalRecord.tsx`
- `apps/web/src/views/appointments/DoctorMedicalRecord.test.tsx`
- Este documento.

Archivos actualizados:

- `apps/api/src/common/types/doctor-appointment.type.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/api/src/services/appointments/appointments-agenda.spec.ts`
- `apps/api/src/modules/encounters/encounters.module.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/web/src/types/doctor-agenda.ts`
- `apps/web/src/utils/permissionLabels.ts`
- `apps/web/src/views/appointments/DoctorAgenda.tsx`
- `apps/web/src/views/appointments/DoctorAgenda.test.tsx`

## Verificación de la entrega

- Rama utilizada: `feat/hu-hcl-03`. No se crearon ramas ni commits.
- Lint: `pnpm --filter medisur-system-backend lint` y `pnpm --filter medisur-system-frontend lint`, ambos correctos tras corregir los hallazgos de las nuevas pruebas.
- `pnpm format`: correcto en ambas aplicaciones.
- `pnpm build`: correcto en ambas aplicaciones. Se conserva el aviso previo de datos antiguos de `baseline-browser-mapping`.
- Backend: `pnpm --filter medisur-system-backend exec jest --runInBand --cacheDirectory node_modules/.cache/jest`, con `APPOINTMENTS_TEST_DATABASE_URL` apuntando a PostgreSQL 16 temporal: 63 suites y 808 pruebas aprobadas, sin omisiones.
- Frontend: `pnpm --filter medisur-system-frontend test`: 51 archivos y 404 pruebas aprobadas.
- `git diff --check`: correcto.
- No se aplicaron migraciones ni seeds a la base de la aplicación. La instancia PostgreSQL temporal se detuvo después de las pruebas.
- Pendiente para despliegue: aplicar la migración y el seed nuevos, y verificar CI remoto al publicar los cambios. No hay criterios funcionales pendientes conocidos ni desviaciones hacia las historias de consulta propia o acceso extraordinario.
