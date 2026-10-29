# HU-HCL-05 — Acceso extraordinario al historial clínico

## Alcance y decisiones del MVP

Una autorización permite consultar el historial general de un paciente concreto a un médico beneficiario concreto. No concede permisos globales ni permite registrar o modificar atenciones. Se requiere un perfil médico activo y el permiso de lectura extraordinaria. La gestión y la lectura son operaciones independientes; STAFF y SUPERADMIN no reciben contenido clínico por administrar autorizaciones.

Cada concesión identifica paciente, beneficiario y actor; conserva motivo obligatorio (10 a 1000 caracteres), tipo `AUTHORIZATION` o `EMERGENCY`, creación y vencimiento. La vigencia obligatoria es futura y de hasta 24 horas. El formulario ofrece 1, 4, 8 o 24 horas. Se prohíben las autoconcesiones y las autorizaciones vigentes duplicadas para un mismo médico/paciente. El motivo debe justificar la autorización y evitar contenido clínico innecesario. La validación documental de la autorización o de la emergencia corresponde al personal habilitado; esta HU registra su declaración y trazabilidad.

La revocación exige un motivo y conserva actor y fecha. No se eliminan concesiones vencidas o revocadas ni registros de lectura. No se implementan edición de concesiones, eliminación física ni trabajos programados: la vigencia se valida en cada petición. Los accesos al historial reutilizan la proyección clínica y la paginación existentes.

## Permisos

| Permiso | Uso | Asignación inicial |
| --- | --- | --- |
| `medical-record.manage-extraordinary` | Buscar personas, listar metadatos, conceder y revocar | Ningún rol base; asignación explícita mediante la gestión de permisos existente |
| `medical-record.get-extraordinary` | Listar concesiones propias vigentes y consultar por concesión | DOCTOR; exige además concesión individual y perfil activo |

Ambos permisos están excluidos del otorgamiento automático a SUPERADMIN. El backend usa los guards existentes y obtiene actor/beneficiario de consulta desde la sesión. No acepta un identificador de usuario alternativo para consultar concesiones propias. Gestionar permisos no equivale a disponer de una concesión, y gestionar concesiones no equivale a poder leer el historial.

## API

Se conserva el prefijo global y el formato de respuestas del proyecto.

| Método y ruta | Permiso | Comportamiento |
| --- | --- | --- |
| `POST /medical-records/extraordinary-access` | Gestión | Cuerpo: `idPatient`, `idBeneficiary`, `type`, `reason`, `expiresAt` ISO con zona horaria |
| `PATCH /medical-records/extraordinary-access/:id/revoke` | Gestión | Cuerpo: `reason`; segunda revocación devuelve conflicto |
| `GET /medical-records/extraordinary-access` | Gestión | Metadatos paginados; incluye concesiones históricas, nunca atenciones |
| `GET /medical-records/extraordinary-access/patients` | Gestión | Selector paginado reutilizado; búsqueda mínima de 3 caracteres |
| `GET /medical-records/extraordinary-access/beneficiaries` | Gestión | Selector médico activo paginado con proyección mínima |
| `GET /medical-records/extraordinary-access/mine` | Lectura | Concesiones propias vigentes y pacientes activos |
| `GET /medical-records/by-extraordinary-grant/:idGrant` | Lectura | Historial paginado solo del paciente de la concesión propia vigente |

Las respuestas de consulta llevan `Cache-Control: no-store`. Todos los listados reutilizan `PaginationQueryDto`, `PaginatedResult<T>` y `paginate()`; frontend usa los tipos comunes y `ListPagination`.

## Integridad y trazabilidad

La migración `1793404800000-ExtraordinaryClinicalGrants` crea `extraordinary_grants`, relaciones restrictivas con usuarios y restricciones de tipo, motivo, vencimiento, autoconcesión y revocación. Adapta `medical_record_accesses` para que cada lectura tenga exactamente una base: cita o concesión extraordinaria. Una concesión conserva referencias a paciente, beneficiario, creador y revocador.

La creación es transaccional y serializa por médico para impedir concesiones activas duplicadas. La lectura bloquea la concesión frente a la revocación concurrente, vuelve a comprobar la vigencia y registra el acceso dentro de la misma transacción. Si falla el registro de acceso, no devuelve contenido clínico. Se conserva el historial ante desactivación o borrado lógico de usuarios. La reversión de la migración se rechaza si hay concesiones para evitar perder trazabilidad.

Las filas persistidas de concesión, revocación y lectura preparan la integración transversal posterior con EPIC-09. No se agrega un sistema alternativo de bitácora ni se escriben motivos o contenido clínico en logs.

## Interfaz

- `/dashboard/medical-records/access-management`: gestión de metadatos, búsqueda de paciente/médico, confirmación de concesión y revocación, estados de carga, vacío, éxito y error. No monta la vista clínica.
- `/dashboard/medical-records/extraordinary`: concesiones vigentes propias y consulta mediante el diálogo clínico existente. La vista comprueba permiso, destinatario y vigencia, limpia el contenido al vencer y revalida al recuperar el foco, actualizar o cambiar de página.

La revocación impide nuevas respuestas del servidor. El contenido ya entregado se revalida mediante las interacciones anteriores; no se implementa comunicación push para retirar una respuesta ya recibida.

## Archivos de implementación

Backend, bajo `apps/api/src/`:

- Nuevos: `entities/medical-records/extraordinary-grant.entity.ts`, `dtos/medical-records/extraordinary-grant.dto.ts`, `common/types/extraordinary-grant.type.ts`, `services/medical-records/extraordinary-grants.service.ts`, `controllers/medical-records/extraordinary-grants.controller.ts`, `controllers/medical-records/extraordinary-grants.http.spec.ts`, `database/migrations/1793404800000-ExtraordinaryClinicalGrants.ts`.
- Modificados: `entities/medical-records/medical-record-access.entity.ts`, `services/medical-records/medical-records.service.ts`, sus pruebas `medical-records.service.spec.ts` y `medical-records.postgres.spec.ts`, `controllers/medical-records/medical-records.controller.ts`, `modules/encounters/encounters.module.ts`, `modules/appointments/appointments.module.ts`, `database/seeders/access-control.catalog.ts`, `access-control.seeder.ts` y `access-control.seeder.spec.ts`.

Frontend, bajo `apps/web/src/`:

- Nuevos: `views/medical-records/ExtraordinaryAccesses.tsx`, `ExtraordinaryGrantActions.tsx`, `ExtraordinaryPersonPicker.tsx` y sus tres archivos `.test.tsx`; `app/dashboard/medical-records/access-management/page.tsx` y `extraordinary/page.tsx`.
- Modificados: `types/medical-records.ts`, `services/medical-records/medicalRecordsService.ts` y su prueba, `views/appointments/DoctorMedicalRecord.tsx` y su prueba, `components/layout/vertical/VerticalMenu.tsx`, `utils/permissionLabels.ts`.

## Verificación y despliegue

- Backend completo: 64 suites, 870 pruebas exitosas, incluidas integraciones con PostgreSQL aislado.
- Frontend completo: 55 archivos, 450 pruebas exitosas.
- Cobertura añadida: concesión ordinaria/emergencia, permisos, aislamiento de beneficiarios/pacientes, relaciones inválidas, autoconcesión, duplicados concurrentes, vencimiento, revocación, concurrencia lectura/revocación, integridad SQL, conservación de trazas, fallo cerrado de auditoría, formularios y estados de interfaz.
- `pnpm lint`, `pnpm format` y `pnpm build`: exitosos para ambas aplicaciones. `git diff --check`: exitoso.

Antes de habilitar en un entorno, ejecutar los comandos existentes `pnpm --filter medisur-system-backend migration:run` y `pnpm --filter medisur-system-backend seed`, revisando la configuración de ese entorno; asignar explícitamente el permiso de gestión al personal autorizado. No se ejecutaron migraciones ni seed contra la base de la aplicación durante esta tarea. Las pruebas usan una instancia PostgreSQL local aislada.

La CI remota queda pendiente de ejecutar al publicar los cambios. La integración general con EPIC-09 queda como dependencia posterior de la épica. No se modificaron tema, providers globales ni infraestructura, ni se creó otra rama.
