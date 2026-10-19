# HU-CIT-05 — Cancelar cita como paciente

## Regla de negocio

El paciente puede cancelar exclusivamente una cita propia, activa, no eliminada y en estado `RESERVED`, hasta antes de su hora de inicio. No se introduce un plazo adicional de antelación no definido en la Issue. La comparación usa la fecha y hora conservadas en la cita y el reloj real de PostgreSQL en `America/La_Paz`, después de adquirir los bloqueos.

Una cita comenzada o pasada no puede cancelarse aunque todavía figure como reservada. Cualquier estado distinto de RESERVED, incluidos CANCELLED, RESCHEDULED y eventuales estados de atención, se rechaza. Repetir la cancelación devuelve conflicto sin modificar nuevamente la fecha o el actor ni afectar una nueva reserva del bloque.

## API, permisos y propiedad

`PATCH /api/appointments/:idAppointment/cancel` requiere sesión vigente y `appointment.cancel-mine`. No recibe cuerpo ni identidad del paciente: ambos, propietario y actor, se obtienen de la sesión. Enviar un paciente, autor, estado o fecha de cancelación en el cuerpo o query no altera la operación.

Una cita inexistente, eliminada o de otro paciente devuelve el mismo 404 «Cita propia no encontrada», sin exponer su estado o titular. Una transición no permitida devuelve 409. Los guards existentes rechazan peticiones sin autenticación o permiso. El catálogo asigna el permiso al rol PATIENT y, según la política vigente, SUPERADMIN; este último tampoco puede cancelar citas ajenas por esta ruta.

Respuesta REST habitual con `idAppointment`, `status: CANCELLED` y `cancelledAt`. No se expone información clínica ni se crea una operación de cancelación administrativa.

## Transacción, auditoría y ocupación

La cancelación comparte con la reserva y edición de horarios el orden de bloqueos: médico, horario y luego cita. Revalida la propiedad bajo bloqueo y realiza un único UPDATE condicionado por estado, actividad y hora de inicio. La actualización guarda simultáneamente `CANCELLED`, `cancelled_at` (timestamptz), `cancelled_by` y el `updated_by` existente. Conserva identificador, paciente, médico, especialidad, fecha/horas, autor original y la fila completa; no ejecuta DELETE ni soft delete.

La migración `1792540000000-AppointmentCancellation` incorpora la auditoría y reemplaza la unicidad global por el índice único parcial `UQ_appointments_schedule`: solo las citas con estado distinto de CANCELLED ocupan el bloque. Se conserva la protección PostgreSQL para solicitudes concurrentes y escritores que omitan el servicio. Las filas CANCELLED anteriores a la migración conservan auditoría nula porque no es posible reconstruir su fecha ni actor.

La consulta de disponibilidad excluye las citas canceladas antes del conteo y paginación. El bloque vuelve a ofrecerse únicamente si sigue cumpliendo las reglas de EPIC-03: horario futuro y activo, médico/cuenta/rol/especialidad activos y asociación vigente. No se reactiva ningún horario ni perfil. Los estados desconocidos o reprogramados siguen ocupando el bloque hasta que su HU defina su transición.

La edición de un horario puede continuar cuando solo tiene historial cancelado; las citas anteriores conservan sus snapshots. Una reserva nueva recibe otro identificador y no sobrescribe la cita cancelada ni su auditoría. La cancelación de la cita anterior no libera una reserva nueva. Una cancelación continúa siendo posible si el perfil del médico se desactivó o eliminó lógicamente, pero eso no hace disponible su horario.

La reversión de la migración no elimina citas para restaurar la unicidad anterior: si ya existen varias citas históricas del mismo bloque, falla antes de cambiar el esquema. Si la unicidad anterior es restituible, el rollback retira las columnas nuevas; debe gestionarse según la política de migraciones del entorno.

## Frontend

«Mis citas» incorpora una acción según `appointment.cancel-mine` para reservas con inicio futuro, reutilizando el listado, filtros y ListPagination existentes. La confirmación muestra médico, especialidad, fecha y horas de Bolivia. No se envía la petición hasta confirmar. Se bloquean doble clic, cierre y botones durante el envío.

El éxito recarga la lista manteniendo filtros y paginación y muestra feedback. Los conflictos de estado/propiedad también recargan la lista y muestran el mensaje del servidor. Un error de red permanece visible en el diálogo y permite reintentar. El backend es la autoridad ante cambios de estado o tiempo entre consulta y confirmación. Los mensajes de una cuenta anterior se ocultan al cambiar la sesión.

## Puesta en marcha

Aplicar `pnpm --filter medisur-system-backend migration:run`, después actualizar permisos con `pnpm --filter medisur-system-backend seed` y renovar la sesión. La tarea no modifica datos de la base de MEDISUR: la migración y las reservas de prueba se validan en PostgreSQL temporal aislado. No cambian arquitectura, providers, tema global ni infraestructura. No se introducen DTOs, helpers o componentes de paginación nuevos.

## Pruebas

Se cubren autenticación, permiso, propiedad, protección de campos de auditoría, estados incompatibles, citas comenzadas/pasadas, actividad y eliminación lógica, persistencia de historial, auditoría, liberación y nueva reserva, bloqueo de cancelación repetida, concurrencia, disponibilidad condicionada y migración de ida/vuelta sin eliminar citas. El frontend prueba confirmación explícita, doble envío, feedback, errores, acciones por permiso y recarga del listado con los filtros actuales.

Las pruebas reales utilizan `APPOINTMENTS_TEST_DATABASE_URL` y el esquema temporal aislado de la suite PostgreSQL existente. Sin esa variable la suite se omite explícitamente, como en las HU previas. La CI necesita recibirla para ejecutar esa cobertura real. No se modifica su infraestructura en esta HU.

## Archivos modificados o creados

- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/migrations/1792540000000-AppointmentCancellation.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/entities/appointments/appointment.entity.ts`
- `apps/api/src/services/appointments/appointments-cancel.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/api/src/services/schedules/schedules.service.ts`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/views/appointments/CancelAppointment.test.tsx`
- `apps/web/src/views/appointments/CancelAppointment.tsx`
- `apps/web/src/views/appointments/MyAppointments.test.tsx`
- `apps/web/src/views/appointments/MyAppointments.tsx`
- `docs/horarios.md`
- `docs/hu-cit-01-reserva.md`
- `docs/hu-cit-04-agenda-medica.md`
- `docs/hu-cit-05-cancelacion.md`

## Resultado de verificación local

- Backend: 54 suites, 625 pruebas correctas, incluidas 48 pruebas reales de PostgreSQL, con `pnpm --filter medisur-system-backend test --runInBand`, la variable de pruebas y caché temporal local.
- Frontend: 47 archivos, 343 pruebas correctas mediante `pnpm --filter medisur-system-frontend test`, con directorio temporal local.
- Checks: `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check`.
- La suite PostgreSQL aplica la migración de citas original y la nueva migración de cancelación, y comprueba su reversión cuando es posible y su rechazo seguro cuando hay historial incompatible con la unicidad anterior.
- No se ejecutaron migraciones ni seed contra la base de MEDISUR. Pendiente en destino: aplicar migración, actualizar permisos y verificar CI remota. La CI no se ejecutó desde esta tarea.
- Sin criterios funcionales pendientes. No se incorporaron cancelaciones administrativas, devoluciones de pagos, notificaciones ni reprogramaciones.
