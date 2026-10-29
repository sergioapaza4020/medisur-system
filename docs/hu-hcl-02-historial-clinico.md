# HU-HCL-02 — Historial clínico único por paciente

## Modelo y flujo

`medical_records` representa el historial general del paciente; no contiene una copia de sus datos personales ni del contenido de las atenciones. `id_patient` es obligatorio, referencia al usuario existente y tiene una restricción única que también abarca registros inactivos o eliminados lógicamente. Cada atención conserva su relación con el paciente y se vincula obligatoriamente con un historial mediante `id_medical_record`.

La relación compuesta `(id_medical_record, id_patient)` impide en PostgreSQL asociar una atención al historial de otro paciente. Las claves foráneas usan `ON DELETE RESTRICT`: eliminar físicamente un paciente con historial o un historial con atenciones es rechazado. La desactivación o eliminación lógica de usuarios conserva los historiales y sus atenciones.

No se crea un historial vacío al registrar al paciente. Se crea al registrar su primera atención válida, después de las validaciones existentes de HU-HCL-01. En la misma transacción de la atención se intenta insertar el historial con `ON CONFLICT (id_patient) DO NOTHING`, se obtiene el registro creado o existente y se guarda la atención asociada. Dos médicos distintos pueden registrar simultáneamente primeras atenciones para el mismo paciente sin generar historiales duplicados. La reutilización no modifica el autor ni las fechas del historial existente.

Un fallo en la inserción de la atención revierte también un historial creado dentro de esa transacción. Un fallo posterior no elimina un historial anterior ni sus atenciones. La búsqueda interna usa `withDeleted` para mantener la identidad única incluso ante datos históricos con eliminación lógica; no reactiva ni borra esos registros. Su estado no concede por sí mismo autorización de lectura.

## Migración y datos existentes

`1793232000000-CreateMedicalRecords` crea la tabla, incorpora un historial por cada paciente con atenciones previas y vincula todas las atenciones existentes, incluidas las inactivas o eliminadas lógicamente y las de pacientes inactivos o eliminados lógicamente. No filtra por roles actuales del usuario al migrar información histórica. No modifica el resumen, médico, especialidad, cita, fecha de atención ni auditoría previa de las atenciones.

Los historiales incorporados por la migración registran su fecha de creación real en la migración y autor nulo; no se inventa un actor o una fecha de creación histórica. El bloqueo de `encounters`, la incorporación de relaciones y la instalación de restricciones se ejecutan en la transacción habitual de migraciones de TypeORM. El despliegue debe coordinar la migración y la versión nueva del backend: escritores anteriores no suministran el historial obligatorio.

Aplicación: `pnpm --filter medisur-system-backend migration:run`. No se necesita ejecutar un seed nuevo. La reversión retira la asociación y la tabla de historiales, preservando las atenciones originales. No revertir sobre historiales cuya identidad y metadatos deban conservarse sin respaldo y decisión explícita.

## Autorización, API y frontend

La existencia del historial no concede acceso clínico a pacientes, médicos, STAFF ni SUPERADMIN. Se conserva el endpoint `POST /api/encounters`, los guards, el permiso `encounter.create` y las validaciones del médico responsable. El historial se obtiene internamente según el paciente validado; el cliente no puede elegirlo con `idMedicalRecord` ni con una relación arbitraria. La confirmación de registro conserva el contrato anterior y no expone el historial ni contenido clínico.

Esta HU no añade consultas, listados, permisos ni rutas de acceso a historiales. HU-HCL-03, HU-HCL-04 y HU-HCL-05 definirán esas operaciones. No se requieren cambios de frontend: el formulario y su servicio de HU-HCL-01 mantienen su contrato. Se revisó TASK-API-01 y su infraestructura común; no se crea paginación porque esta historia no introduce listados.

## Pruebas

- Servicio de atenciones: creación/reutilización interna, asociación al historial correcto, fallo del historial y conservación de la respuesta pública.
- HTTP: los campos de historial enviados por el cliente se descartan; el historial no incorpora rutas de lectura, ni siquiera para un rol administrativo. Se conserva la cobertura de autenticación, permisos y aislamiento de HU-HCL-01.
- PostgreSQL: migración real sobre esquema temporal, creación diferida, reutilización sin alterar auditoría, concurrencia entre dos médicos, aislamiento entre pacientes, unicidad, claves foráneas, relación obligatoria, bloqueo de borrado físico, rollback del historial nuevo y conservación del previo, desactivación/soft delete, reutilización histórica y migración/reversión de atenciones previas sin pérdida de contenido.

Las suites PostgreSQL reutilizan `APPOINTMENTS_TEST_DATABASE_URL` y crean esquemas temporales aislados. Nunca usan `DATABASE_URL`; se omiten explícitamente si la conexión de pruebas no está configurada.

## Archivos

- `apps/api/src/entities/medical-records/medical-record.entity.ts`: entidad de historial único y relación con atenciones.
- `apps/api/src/entities/encounters/encounter.entity.ts`: relación compuesta obligatoria con el historial.
- `apps/api/src/database/migrations/1793232000000-CreateMedicalRecords.ts`: tabla, incorporación de datos previos y restricciones.
- `apps/api/src/modules/encounters/encounters.module.ts`: registro de la entidad en el módulo existente.
- `apps/api/src/services/encounters/encounters.service.ts`: creación/reutilización dentro de la transacción existente.
- `apps/api/src/services/encounters/encounters.service.spec.ts`: pruebas unitarias ampliadas.
- `apps/api/src/services/encounters/encounters.postgres.spec.ts`: adaptación de la suite anterior al modelo y migración nuevos.
- `apps/api/src/services/encounters/medical-records.postgres.spec.ts`: cobertura de integridad, concurrencia y migración.
- `apps/api/src/controllers/encounters/encounters.http.spec.ts`: identidad de historial no controlada por el cliente y ausencia de rutas de lectura.
- `docs/hu-hcl-01-registro-atencion.md`: enlace al modelo incorporado por esta historia.
- Este documento.

## Verificación de la entrega

- Rama utilizada: `feat/hu-hcl-02`; no se crearon ramas ni commits.
- `pnpm lint`: correcto en ambas aplicaciones.
- `pnpm format`: correcto en ambas aplicaciones.
- `pnpm build`: correcto en ambas aplicaciones; frontend reutilizado desde caché de Turborepo por no haber cambiado su código. Permanece el aviso previo de `baseline-browser-mapping`.
- `pnpm --filter medisur-system-backend exec jest --runInBand --cacheDirectory node_modules/.cache/jest`, con `APPOINTMENTS_TEST_DATABASE_URL` apuntando a PostgreSQL 16 temporal: 60 suites y 774 pruebas aprobadas, sin omisiones. Incluye las 9 pruebas nuevas de historial, las suites reales de citas y atenciones, y la cobertura HTTP/unitaria ampliada.
- `pnpm --filter medisur-system-frontend test`: 49 archivos y 387 pruebas aprobadas.
- `git diff --check`: correcto.
- La instancia PostgreSQL temporal se detuvo al finalizar. No se aplicaron migraciones ni seeds a la base de la aplicación.
- Pendientes de despliegue: aplicar la migración nueva coordinada con el backend y verificar CI remoto al publicar los cambios. No hay criterios funcionales pendientes conocidos ni ampliaciones hacia las historias de consulta clínica.
