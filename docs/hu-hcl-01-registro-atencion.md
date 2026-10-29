# HU-HCL-01 — Registrar atención médica

## Contrato y permisos

`POST /api/encounters` requiere sesión válida, `encounter.create` y perfil médico activo, reutilizando `SchedulesService.ownDoctor`. El médico y el autor se obtienen exclusivamente de la sesión. No se habilita registro en nombre de otro médico.

Con cita: `{ "idAppointment": 9, "summary": "Resumen de la atención realizada" }`. El backend exige una cita propia, activa, reservada y cuyo inicio ya haya ocurrido (hora de Bolivia). Paciente y especialidad se derivan de la cita; si se envían también, deben coincidir. No se modifica el estado de la cita. Las asociaciones históricas permiten utilizar la especialidad de la cita aunque se haya retirado de las asignaciones actuales, siempre que continúe activa.

Sin cita: `{ "idPatient": 5, "idSpecialty": 7, "summary": "Resumen de la atención realizada" }`. Se exige paciente activo con rol PATIENT activo y especialidad activa asignada al médico. No se concede acceso de lectura al historial por registrar una atención.

El contenido mínimo es un resumen libre obligatorio de 1 a 10000 caracteres después de recortar extremos. No se introducen diagnósticos, recetas, signos vitales ni campos clínicos estructurados sin requerimientos validados. La fecha/hora corresponde al registro actual del servidor; no se permite fechar retroactivamente desde el cliente.

La respuesta contiene exclusivamente `idEncounter`, `idPatient`, `idDoctor`, `idSpecialty`, `idAppointment` (o null) y `occurredAt`. No incluye resumen, credenciales ni entidades completas.

El seed crea `encounter.create` y lo asigna a DOCTOR. La clasificación clínica excluye este permiso de las concesiones automáticas a SUPERADMIN; STAFF y PATIENT tampoco lo reciben. Se conservan las asignaciones explícitas existentes y los permisos desactivados. Un permiso explícito no sustituye la validación del perfil médico.

## Persistencia y conservación

La migración `1792886400000-CreateEncounters` crea `encounters`, sus relaciones restrictivas a paciente, médico, especialidad y cita opcional, fecha/hora, resumen y los campos de BaseEntity. El índice por paciente/fecha prepara la asociación con el historial general. [HU-HCL-02](hu-hcl-02-historial-clinico.md) incorpora posteriormente el historial único y su asociación transaccional; las consultas y accesos de HU-HCL-03 a HU-HCL-05 corresponden a historias posteriores.

Cada operación inserta una atención nueva en una transacción y conserva las anteriores; no existen rutas de modificación o eliminación. Se reutiliza el bloqueo del médico que serializa operaciones de citas y horarios. La eliminación física de las entidades referenciadas queda restringida; su desactivación o soft delete no elimina las atenciones. `summary` no se selecciona por defecto en TypeORM. No se añaden logs de contenido clínico y las respuestas de validación no incluyen el valor rechazado. `createdBy` y `createdAt` preparan la trazabilidad sin implementar la bitácora transversal de EPIC-09.

Aplicar en el entorno de destino con `pnpm --filter medisur-system-backend migration:run` y después `pnpm --filter medisur-system-backend seed`. La reversión elimina la tabla: no ejecutarla sobre datos clínicos que deban conservarse sin una decisión y respaldo correspondientes.

## Interfaz

La agenda médica permite registrar una atención desde el resumen de una cita elegible. Incluye paciente y especialidad de la cita, validación, bloqueo de doble envío, loading, éxito y errores con posibilidad de reintento. También ofrece registro sin cita mediante identificadores de paciente y especialidad; no introduce un directorio general de pacientes para médicos. El backend valida esos identificadores. El contenido se limpia al guardar o cerrar; un cambio de cuenta remonta el formulario. No se almacena el resumen en navegador ni se transporta en URL.

No se crean listados ni paginación nueva. La agenda conserva la infraestructura existente de TASK-API-01.

## Pruebas

Las pruebas del servicio cubren perfil médico, inserciones independientes, derivación desde cita propia, cita ajena/inexistente, estados inválidos, cita futura, relaciones contradictorias, paciente inválido, especialidad inválida/no asignada y fallo de persistencia. Las pruebas HTTP usan guards, estrategia JWT, validación e interceptor existentes y verifican 401/403, ausencia de bypass por roles, DTO y protección de identidad/fecha/autor. El seed prueba exclusión clínica de SUPERADMIN.

Las pruebas frontend verifican permiso, elegibilidad, contexto, validación, doble envío, loading, éxito y error. La prueba PostgreSQL ejecuta la migración real en un esquema temporal con `APPOINTMENTS_TEST_DATABASE_URL`, comprueba inserciones concurrentes, conservación tras soft delete, restricción de borrado físico y rollback ante relaciones inválidas. Se omite explícitamente sin esa variable y nunca usa DATABASE_URL.

## Verificación de esta entrega

- `pnpm lint`: backend y frontend correctos. La última ampliación de la prueba PostgreSQL también se verifica con ESLint.
- `pnpm format`: comprobación global del formato, sin aplicar cambios fuera de la HU.
- `pnpm build`: backend y frontend compilan. Se conserva el aviso preexistente de baseline-browser-mapping.
- `pnpm --filter medisur-system-backend exec jest --runInBand --cacheDirectory node_modules/.cache/jest`: 57 suites y 664 pruebas aprobadas; la suite previa de citas omite 93 casos si no se configura su conexión dedicada.
- `pnpm --filter medisur-system-frontend test`: 49 archivos y 387 pruebas aprobadas. Tras el último ajuste del formulario se repiten RegisterEncounter y DoctorAgenda: 28 pruebas aprobadas.
- `pnpm --filter medisur-system-backend exec jest --runInBand --cacheDirectory node_modules/.cache/jest encounters.postgres`: 3 pruebas aprobadas con una instancia PostgreSQL 16 temporal y aislada, incluyendo cita propia, aislamiento entre médicos y paciente contradictorio. Se detuvo la instancia al finalizar; no se aplicaron migraciones ni seeds sobre la base de la aplicación.
- CI remoto pendiente de ejecución al publicar los cambios. No se han creado ramas ni commits.

## Archivos de la HU

Backend: `src/app.module.ts`; `src/controllers/encounters/encounters.controller.ts` y `encounters.http.spec.ts`; `src/dtos/encounters/create-encounter.dto.ts`; `src/entities/encounters/encounter.entity.ts`; `src/modules/encounters/encounters.module.ts`; `src/services/encounters/encounters.service.ts`, `encounters.service.spec.ts` y `encounters.postgres.spec.ts`; `src/database/migrations/1792886400000-CreateEncounters.ts`; `src/database/seeders/access-control.catalog.ts`, `access-control.seeder.ts` y `access-control.seeder.spec.ts` (rutas relativas a `apps/api`).

Frontend: `src/services/encounters/encountersService.ts`; `src/types/encounters.ts`; `src/views/appointments/RegisterEncounter.tsx`, `RegisterEncounter.test.tsx`, `DoctorAgenda.tsx` y `DoctorAgenda.test.tsx`; `src/utils/permissionLabels.ts` (rutas relativas a `apps/web`). Documentación: este archivo.
