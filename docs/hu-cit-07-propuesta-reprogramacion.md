# HU-CIT-07 — Proponer reprogramación de cita

## Reglas implementadas

Una propuesta es un registro separado vinculado a una cita original cancelada, activa y no eliminada. La crea el médico relacionado con perfil activo y permiso appointment.propose-rescheduling. Se conserva el alcance propio también para SUPERADMIN: el permiso no otorga acceso a citas de otros médicos ni a información clínica.

La alternativa debe ser un bloque completo futuro del mismo médico y especialidad. Se reutiliza la disponibilidad de EPIC-03, incluidas sus reglas de actividad, asociación y ocupación. Se rechazan horarios inexistentes, inactivos, pasados, ocupados, de otra especialidad/médico, con versión desactualizada o con la misma fecha y horas originales. La consulta y la creación resuelven médico/especialidad desde la cita; el cliente no decide el propietario ni el paciente.

La propuesta nace PENDING y el modelo identifica también ACCEPTED y REJECTED. Solo se permite una propuesta PENDING por cita mediante índice único parcial; el historial de otros estados puede conservarse. No se implementan en esta HU las operaciones de aceptación/rechazo ni se cambia silenciosamente la cita a RESCHEDULED. Esas transiciones corresponden al flujo posterior de gestión de propuestas.

La propuesta no ocupa ni reserva el horario. Se valida la disponibilidad al crearla, pero la aceptación futura deberá volver a validar el bloque, su versión y las reglas de reserva. El paciente recibe esta información claramente en la consulta. Esta decisión evita convertir una propuesta aún no aceptada en una reserva y no modifica las reglas actuales de HU-CIT-01.

## Trazabilidad, integridad y notificaciones

La nueva entidad rescheduling_proposals guarda referencias a la cita y al horario alternativo, versión del horario, snapshots de fecha y horas originales y propuestas, estado, autor y fecha de creación. La cita original conserva su estado CANCELLED y toda su auditoría. La edición posterior de horarios no reemplaza los snapshots de la propuesta. Las claves foráneas restringen la eliminación física de las referencias y las restricciones validan los estados y el orden de las horas.

La creación se ejecuta en transacción con el mismo orden de bloqueos que reservas y cancelaciones: médico → horario → cita. Se revalidan perfil, propiedad y estado después de esperar los bloqueos, y se consulta la disponibilidad compartida antes de persistir. Las reservas y ediciones que usan los mismos bloqueos no pueden introducir un horario ocupado entre la validación y la confirmación. Las propuestas duplicadas concurrentes producen un único registro pendiente y conflictos claros para el resto.

El punto duradero para EPIC-07 es la fila de propuesta confirmada en la transacción. Conserva id_proposal (clave del evento para futura idempotencia), referencia a la cita/paciente, autor, fecha, estado y snapshots. El módulo de notificaciones podrá procesar ese contexto después del commit y deberá gestionar sus entregas y reintentos. Esta HU no envía notificaciones ni incorpora infraestructura, colas o providers de envío.

## API

- POST /api/appointments/:idAppointment/rescheduling-proposals: permiso appointment.propose-rescheduling; cuerpo con idSchedule y expectedVersion, reutilizando CreateAppointmentDto. Devuelve la propuesta pendiente y ambas fechas/horas.
- GET /api/appointments/:idAppointment/rescheduling-availability: mismo permiso; date o from/to y paginación heredados de AvailabilityQueryDto mediante OmitType. El servidor resuelve médico y especialidad desde la cita.
- GET /api/appointments/:idAppointment/rescheduling-proposals: permiso appointment.get-mine; consulta exclusivamente una cita del paciente autenticado y usa PaginationQueryDto, PaginatedResult y paginate(). Orden estable por creación e identificador descendentes.

La respuesta pública contiene solo idProposal, fechas/horas originales y propuestas, estado y zona horaria. No expone documentos, contactos, contenido clínico ni campos internos de auditoría. Se descartan identidades, fechas arbitrarias y estados enviados en campos ajenos al DTO. Los guards actuales verifican sesión y permisos; el servicio verifica la propiedad. Citas ajenas/inexistentes devuelven 404 sin revelar su propietario, entradas inválidas 400, falta de permiso/perfil 403 y conflictos de estado/disponibilidad/duplicado 409.

## Frontend y reutilización

La agenda médica ofrece Proponer reprogramación en el resumen de una cita cancelada y solo con el permiso específico. El diálogo muestra paciente, especialidad y horario original, permite consultar una fecha y seleccionar un bloque disponible, y exige confirmar. Bloquea doble envío y acciones durante la creación; muestra errores y vuelve a consultar disponibilidad cuando la creación falla. El éxito conserva fecha/vista/filtros de la agenda y muestra feedback.

Mis citas ofrece Ver propuestas en las citas canceladas, con estado, horario anterior y alternativa. Gestiona loading, errores, reintento y ausencia de propuestas. Las respuestas obsoletas se ignoran y los componentes se identifican por usuario/cita para evitar datos de otra sesión.

Se reutilizan AvailabilitySlots, los controles Material UI, el cliente HTTP y la paginación común. AvailabilitySlots recibe únicamente un callback opcional de selección; los usos de consulta y reserva actuales conservan su comportamiento. Los listados nuevos usan PaginationQuery, PaginatedResponse, los metadatos existentes y ListPagination. No se agregan DTOs, helpers o componentes de paginación duplicados ni se modifican tema global, arquitectura o infraestructura.

## Despliegue y límites

Aplicar pnpm --filter medisur-system-backend migration:run y después pnpm --filter medisur-system-backend seed para incorporar el esquema y el permiso al rol DOCTOR según el catálogo existente. Renovar la sesión para obtener permisos actuales. El módulo de citas registra la entidad adicional dentro de su configuración existente; no se crea otro módulo ni servicio paralelo de reservas.

La migración 1792710000000-ReschedulingProposals crea la tabla y su índice. Su reversión retira esa tabla conforme al patrón de migraciones del proyecto; debe gestionarse según la política de respaldo del entorno si ya contiene historial.

No se ejecutaron migraciones ni seed sobre la base de MEDISUR. Las pruebas reales usan APPOINTMENTS_TEST_DATABASE_URL con PostgreSQL temporal y un esquema aislado. Sin esa variable la suite se omite como en las HU anteriores. La CI remota debe disponer de esa base para ejecutar esta cobertura; no se modifica la configuración de CI en esta HU.

## Verificación local

- Backend: 55 suites y 694 pruebas correctas, incluidas las pruebas reales de PostgreSQL. Comando: pnpm --filter medisur-system-backend test --runInBand --cacheDirectory D:/uatf/sis940/medisur-system/node_modules/.cache/cit07-jest, con APPOINTMENTS_TEST_DATABASE_URL apuntando al servidor temporal.
- Frontend: 48 archivos y 372 pruebas correctas. Comando: pnpm --filter medisur-system-frontend test, con TEMP/TMP locales para las cachés de pruebas.
- pnpm build: correcto en ambas aplicaciones.
- pnpm lint: correcto en ambas aplicaciones, sin errores ni advertencias de ESLint.
- pnpm format: correcto en ambas aplicaciones.
- git diff --check: correcto.
- La base PostgreSQL temporal fue detenida y eliminada; la base de MEDISUR no se utilizó.
- Se cubren permisos, protección de campos e identidad, propiedad médica y del paciente, perfiles inválidos, estados incompatibles, disponibilidad inválida/ocupada, versiones, propuesta repetida/concurrente, conservación de snapshots, historial paginado y campos mínimos expuestos.
- El frontend cubre selección y confirmación, doble envío, estados, errores/conflictos, loading, vacío, recarga, paginación y respuestas obsoletas.
- Pendiente de entorno: aplicar migración, actualizar permisos y verificar CI remota tras publicación. El envío de notificaciones y las operaciones de aceptación/rechazo pertenecen a sus HU posteriores.

## Archivos modificados o creados

- `apps/api/src/common/types/rescheduling-proposal.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/migrations/1792710000000-ReschedulingProposals.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/database/seeders/access-control.seeder.ts`
- `apps/api/src/dtos/appointments/rescheduling-availability-query.dto.ts`
- `apps/api/src/entities/appointments/rescheduling-proposal.entity.ts`
- `apps/api/src/modules/appointments/appointments.module.ts`
- `apps/api/src/services/appointments/appointments-proposals.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/types/rescheduling-proposal.ts`
- `apps/web/src/views/appointments/DoctorAgenda.test.tsx`
- `apps/web/src/views/appointments/DoctorAgenda.tsx`
- `apps/web/src/views/appointments/MyAppointments.test.tsx`
- `apps/web/src/views/appointments/MyAppointments.tsx`
- `apps/web/src/views/appointments/PatientProposals.tsx`
- `apps/web/src/views/appointments/ProposeRescheduling.tsx`
- `apps/web/src/views/appointments/Rescheduling.test.tsx`
- `apps/web/src/views/schedules/AvailabilitySlots.tsx`
- `docs/hu-cit-07-propuesta-reprogramacion.md`
