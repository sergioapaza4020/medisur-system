# HU-CIT-02 — Registrar cita desde recepción

## Alcance y autorización

Ruta frontend `/dashboard/appointments/reception`, enlace «Reservar desde recepción». La operación requiere `appointment.create-for-patient`; el seed existente lo asigna a STAFF y, según la política vigente, SUPERADMIN. PATIENT y DOCTOR no lo reciben automáticamente. Se autorizan capacidades, sin excepciones por nombre de rol.

La interfaz también requiere los permisos existentes `schedule.get-availability` y `doctor.get-by-specialty`, ya concedidos a STAFF, para reutilizar los catálogos y disponibilidad activos. El registro de un paciente nuevo conserva su autorización independiente: `user.create-patient`.

Actualizar el catálogo con `pnpm --filter medisur-system-backend seed` y renovar la sesión. No hay migraciones nuevas, entidades nuevas ni cambios en infraestructura, arquitectura, providers o tema global.

## API

- `GET /api/appointments/patients?search=Ana&page=1&limit=10`: selección paginada de pacientes existentes, con `appointment.create-for-patient`. Busca por nombre, apellido o documento; requiere entre 3 y 200 caracteres después de recortar espacios. Solo devuelve cuentas activas no eliminadas con perfil PATIENT activo no eliminado. Proyecta `idUser`, `name`, `lastname` y `ci`, sin correos, contraseñas, roles, auditoría ni datos clínicos. Usa `PaginationQueryDto`, `PaginatedResult<T>` y `paginate()` antes de proyectar.
- `POST /api/appointments/for-patient`: cuerpo `{ "idSchedule": 9, "expectedVersion": 1, "idPatient": 7 }`. Requiere `appointment.create-for-patient`. El paciente es explícito y el autor se toma exclusivamente de la sesión. Se descartan campos falsificados como `createdBy`, `actorId`, estado, fecha o médico. La respuesta mantiene el contrato de creación de HU-CIT-01.
- `POST /api/appointments` conserva su permiso `appointment.create` y obtiene el paciente exclusivamente de la sesión. Enviar `idPatient` a esa ruta no convierte una reserva propia en administrativa.

La consulta de selección es específica porque la búsqueda previa de HU-USR-03 incluye cuentas inactivas y de otros perfiles para prevenir duplicados, expone campos adicionales de registro y requiere un permiso distinto. No se amplía el acceso a los endpoints administrativos generales de usuarios.

## Integridad y auditoría

Las dos rutas de creación delegan en el mismo método transaccional de AppointmentsService. Se conserva el orden de bloqueo por médico y horario, la validación de versión, las reglas de disponibilidad de EPIC-03, la comprobación de fecha/hora de Bolivia y la restricción única de PostgreSQL. Se reserva el bloque completo en estado `RESERVED`.

Después de esperar los bloqueos, se valida nuevamente la cuenta de paciente y se mantiene un bloqueo de lectura sobre su fila hasta finalizar la transacción. No se admiten pacientes inexistentes, inactivos, eliminados o sin perfil PATIENT activo. La cita se relaciona con ese paciente y `createdBy` registra al operador de recepción mediante la infraestructura de auditoría existente. No se permite sustituir al autor desde el cliente.

Un conflicto de disponibilidad, versión o paciente seleccionado ya no válido produce un error claro; una petición sin sesión o sin permiso se rechaza con los guards existentes. La reserva sigue eliminando el bloque de la disponibilidad para todos los usuarios. Una reserva administrativa aparece en «Mis citas» del paciente objetivo, no en las del operador.

## Interfaz y reutilización

La búsqueda usa `PaginationQuery`, `PaginationMeta`, `PaginatedResponse<T>` y `ListPagination` comunes. Incluye búsqueda explícita, carga sin resultados anteriores, error con reintento, estado vacío, recuperación de página y descarte de respuestas obsoletas. El flujo se reinicia si cambia la cuenta autenticada.

Al seleccionar al paciente se muestran su nombre y documento con un aviso de que la reserva se realiza en nombre de otro usuario. Se reutilizan MedicalAvailability, DoctorsBySpecialty, AvailabilityCalendar, AvailabilitySlots y AppointmentBooking; este último identifica al paciente también en la confirmación y elige explícitamente el endpoint administrativo. Si falta el permiso administrativo, no hay una caída al flujo de reserva propia.

Si no existe el paciente y el operador tiene `user.create-patient`, se ofrece el enlace a `/dashboard/patients/register` de HU-USR-03. Después del registro puede regresar a recepción y buscar al paciente. Las cuentas existentes inactivas requieren revisión del personal autorizado; no se reactivan ni se duplican en este flujo.

## Pruebas

Se amplían las suites existentes con autenticación y permiso específico de ambas rutas, validación de paciente y búsqueda, protección del autor, proyección mínima, búsqueda paginada y escapado literal de búsquedas. PostgreSQL real verifica reserva administrativa correcta, auditoría, duplicados, solicitudes concurrentes de recepción y paciente, pacientes que dejan de ser elegibles y las mismas reglas de disponibilidad. Las pruebas frontend cubren selección, identificación del paciente, reutilización del flujo, permisos, paginación, enlace de registro, errores y ausencia de resultados.

La suite PostgreSQL utiliza la variable existente `APPOINTMENTS_TEST_DATABASE_URL`, con un esquema temporal aleatorio que se elimina al finalizar. No utiliza `DATABASE_URL`. Sin la variable se omite explícitamente esa suite; la CI existente necesita recibirla para ejecutar esa cobertura real.

## Archivos modificados o creados

- `apps/api/src/common/types/booking-patient.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/dtos/appointments/create-administrative-appointment.dto.ts`
- `apps/api/src/dtos/appointments/patient-selection-query.dto.ts`
- `apps/api/src/services/appointments/appointments-mine.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/web/src/app/dashboard/appointments/reception/page.tsx`
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/types/booking-patient.ts`
- `apps/web/src/views/appointments/ReceptionBooking.test.tsx`
- `apps/web/src/views/appointments/ReceptionBooking.tsx`
- `apps/web/src/views/schedules/AppointmentBooking.test.tsx`
- `apps/web/src/views/schedules/AppointmentBooking.tsx`
- `apps/web/src/views/schedules/AvailabilitySlots.tsx`
- `apps/web/src/views/schedules/MedicalAvailability.test.tsx`
- `apps/web/src/views/schedules/MedicalAvailability.tsx`
- `docs/hu-cit-02-recepcion.md`

## Resultado de verificación local

- Suite backend completa: 52 suites, 576 pruebas correctas, incluidas 27 pruebas reales de PostgreSQL con la variable `APPOINTMENTS_TEST_DATABASE_URL`. Se ejecutó con `pnpm --filter medisur-system-backend test --runInBand` y caché temporal local.
- Suite frontend completa: 45 archivos, 317 pruebas correctas, mediante `pnpm --filter medisur-system-frontend test` y directorio temporal local.
- `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check` verificados.
- Se usó una instancia temporal de PostgreSQL con esquema aislado; no se ejecutaron migraciones ni seed sobre la base de MEDISUR.
- Pendiente de despliegue: ejecutar el seed de permisos y verificar CI remota. La CI no se ejecutó desde esta tarea. No quedaron criterios funcionales pendientes ni se amplió el alcance a cancelaciones, pagos o notificaciones.
