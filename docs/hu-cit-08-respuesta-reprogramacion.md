# HU-CIT-08 — Aceptar o rechazar reprogramación

## Transición e historial

El paciente autenticado con permiso appointment.respond-rescheduling puede responder exclusivamente propuestas vinculadas a sus propias citas. La decisión debe ser ACCEPTED o REJECTED y la propuesta debe seguir activa, no eliminada y en estado PENDING. La cita original debe seguir cancelada y no tener otra propuesta aceptada.

La aceptación adopta el horario ofrecido mediante una cita de reemplazo en estado RESERVED vinculada a la propuesta. Se conserva intacta la cita CANCELLED original, con sus fechas, horas, motivo y actor de cancelación. Esto mantiene la trazabilidad de HU-CIT-06/07 y permite que el horario original continúe disponible según sus reglas, incluso si otro paciente ya lo reservó. No se altera el índice de ocupación ni se reutiliza la fila histórica cancelada.

La propuesta pasa PENDING → ACCEPTED, conserva ambos snapshots, registra responded_at y responded_by, y guarda id_resulting_appointment. La cita de reemplazo conserva paciente, médico y especialidad de la atención y aparece en Mis citas y en la agenda en su nueva fecha. Puede usar normalmente las reglas existentes de cancelación y reserva porque nace RESERVED.

El rechazo pasa PENDING → REJECTED con fecha y actor, sin crear citas ni ocupar horarios. La propuesta de HU-CIT-07 nunca fue una reserva temporal, por lo que no se libera ni modifica un bloque al rechazar. Es posible rechazar aunque el horario haya dejado de estar disponible. El médico puede proponer otra alternativa después del rechazo; no puede crear otra propuesta para el original cuando ya tiene una aceptada.

## Validación y concurrencia

La reserva existente se extrajo a una operación interna que recibe el EntityManager de la transacción. Las reservas normales y administrativas siguen usando esa misma operación y conservan sus reglas y errores. La aceptación la ejecuta dentro de la transacción de respuesta: no crea otra transacción ni duplica las reglas de reserva.

Antes de aceptar se comprueba que el horario conserve versión, fecha/horas, médico y especialidad de la propuesta. Después se ejecutan las reglas compartidas de disponibilidad: horario futuro y activo, perfiles/cuenta/rol/especialidad activos, asociación vigente y ausencia de otra cita que ocupe el bloque. El reloj real de PostgreSQL se consulta después de esperar los bloqueos. También se valida la cuenta activa del paciente mediante la lógica de reserva existente.

El orden de bloqueo es médico → horario alternativo (solo al aceptar) → cita original → propuesta. Se revalidan propiedad, actividad, eliminación y estado bajo bloqueo. La actualización condicionada por PENDING y el índice único de cita ocupante impiden aceptar/rechazar dos veces o reservar el mismo bloque ante solicitudes concurrentes. El índice único parcial UQ_accepted_proposal_appointment impide dos propuestas aceptadas para el mismo original.

La cita de reemplazo, el estado y la auditoría de respuesta se confirman o revierten juntos. Si otro paciente ocupó el bloque, el horario cambió o falla la reserva, la propuesta permanece PENDING y no queda una cita parcial. El paciente puede rechazar esa propuesta o solicitar otra alternativa; no se marca aceptada una reserva fallida. Repetir una respuesta devuelve 409 y no sobrescribe fecha ni actor.

## API, permisos y confidencialidad

- PATCH /api/appointments/rescheduling-proposals/:idProposal/response requiere appointment.respond-rescheduling. Cuerpo: { "status": "ACCEPTED" } o { "status": "REJECTED" }. El actor procede únicamente de la sesión. No se aceptan identidades, horarios o auditoría arbitrarios del cliente.
- GET /api/appointments/:idAppointment/rescheduling-proposals/doctor requiere appointment.get-agenda y perfil médico activo asociado a la cita. Permite al médico consultar estados y vínculo de reemplazo. No concede acceso a otros médicos.
- La consulta existente del paciente conserva appointment.get-mine y alcance propio. Ambos listados reutilizan una consulta común que mantiene el predicado de propietario en el SELECT paginado.

Se reutilizan PaginationQueryDto, PaginatedResult y paginate(), y sus tipos y ListPagination en frontend. No se crean DTOs, helpers o componentes de paginación nuevos. El DTO de respuesta solo valida la decisión con IsIn.

El catálogo agrega appointment.respond-rescheduling al rol PATIENT y, por la política existente, a SUPERADMIN. Ninguno puede responder propuestas ajenas por esta ruta. STAFF y DOCTOR no reciben el nuevo permiso por defecto. Los guards existentes verifican sesión y permiso; el servicio verifica la propiedad antes de operar.

Entradas inválidas devuelven 400; ausencia de autenticación 401; falta de permiso o cuenta apta 403; propuesta ajena/inexistente/eliminada 404; estado incompatible, respuesta repetida o disponibilidad inválida 409. Se mantiene la respuesta mínima de propuesta y se agregan respondedAt y resultingAppointmentId. No se exponen contactos, documentos ni información clínica.

## Auditoría y notificación posterior

La migración 1792800000000-ReschedulingResponses agrega fecha/actor de respuesta y referencia a la cita de reemplazo, con claves foráneas restrictivas e índice de aceptación única. Las restricciones mantienen juntos fecha/actor y evitan una referencia de reemplazo fuera de ACCEPTED. Los estados históricos sin estos campos permanecen nulos; no se inventa auditoría anterior. La reversión retira las columnas y restricciones nuevas según la política de respaldo del entorno.

El punto duradero de integración con EPIC-07 es la propuesta respondida y confirmada: id_proposal, decisión, responded_at, responded_by, cita original, snapshots y cita de reemplazo. El módulo futuro podrá procesarlo después del commit y usar el identificador y la respuesta para su idempotencia y seguimiento. No se añaden envíos, colas, providers ni infraestructura de notificaciones en esta HU.

## Frontend

Mis citas conserva su listado y filtros. En Ver propuestas se muestran Aceptar/Rechazar solo con el permiso de respuesta y para propuestas PENDING. Se pide confirmación explícita, se bloquea doble envío y se deshabilitan cierre/paginación/acciones durante el envío. El éxito informa la reserva o el rechazo y recarga Mis citas para mostrar la nueva atención conservando filtros. Los errores se muestran en el diálogo y se vuelve a consultar el estado para no seguir ofreciendo acciones obsoletas.

La agenda reutiliza el mismo diálogo en modo médico de solo lectura para consultar propuestas de la cita cancelada. Muestra ACCEPTED/REJECTED y el identificador de reemplazo; la nueva reserva también aparece en el calendario de su nueva fecha. No se introducen componentes visuales alternativos, cambios al tema, arquitectura o providers globales.

## Puesta en marcha y comprobaciones

En destino: pnpm --filter medisur-system-backend migration:run, después pnpm --filter medisur-system-backend seed y renovar sesión. Esta tarea no ejecuta estos comandos sobre la base de MEDISUR.

Las pruebas reales utilizan APPOINTMENTS_TEST_DATABASE_URL y un esquema aislado en PostgreSQL temporal. La primera ejecución encontró timeouts de 5 segundos en fixtures previos de integración; se repitió la suite con --testTimeout 30000, sin omitir pruebas ni modificar controles del repositorio. La CI requiere proporcionar la variable existente para ejecutar las pruebas PostgreSQL; sin ella la suite se omite conforme al patrón de las HU anteriores.

La cobertura incluye aceptación y rechazo, acceso ajeno, permisos/DTO, protección de identidad, horarios ocupados/inactivos/editados/pasados, perfiles inválidos, respuesta repetida, competencia aceptar/rechazar y aceptación/reserva normal, auditoría, historial y consulta del médico. Las pruebas frontend cubren confirmación, permiso separado, doble envío, errores, estado actualizado y recarga de Mis citas.

## Archivos modificados o creados

- `apps/api/src/common/types/rescheduling-proposal.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/migrations/1792800000000-ReschedulingResponses.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/dtos/appointments/respond-rescheduling.dto.ts`
- `apps/api/src/entities/appointments/rescheduling-proposal.entity.ts`
- `apps/api/src/services/appointments/appointments-proposals.spec.ts`
- `apps/api/src/services/appointments/appointments-responses.spec.ts`
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
- `apps/web/src/views/appointments/Rescheduling.test.tsx`
- `docs/hu-cit-08-respuesta-reprogramacion.md`

## Resultado final de verificación local

- Backend: 56 suites, 727 pruebas correctas, incluidas las pruebas reales de PostgreSQL y concurrencia. Comando: pnpm --filter medisur-system-backend test --runInBand --testTimeout 30000 --cacheDirectory D:/uatf/sis940/medisur-system/node_modules/.cache/cit08-jest, con APPOINTMENTS_TEST_DATABASE_URL apuntando al servidor temporal aislado.
- Frontend: 48 archivos, 379 pruebas correctas. Comando: pnpm --filter medisur-system-frontend test, con TEMP/TMP locales para la caché de pruebas.
- pnpm lint: correcto en ambas aplicaciones, sin errores ni advertencias de ESLint.
- pnpm format: correcto en ambas aplicaciones.
- pnpm build: correcto en ambas aplicaciones.
- git diff --check: correcto.
- La base temporal fue detenida y eliminada. No se ejecutaron migraciones ni seed sobre la base de MEDISUR.
- Sin criterios funcionales pendientes conocidos. La transición se implementa explícitamente mediante cita de reemplazo vinculada, conservando el registro original cancelado; no se cambia su identificador ni su auditoría.
- Pendiente de entorno: aplicar migración, actualizar permisos y renovar sesión. CI remota no ejecutada desde esta tarea; necesita la variable existente de PostgreSQL para esa cobertura. No se implementa el envío de notificaciones, que corresponde a EPIC-07.
