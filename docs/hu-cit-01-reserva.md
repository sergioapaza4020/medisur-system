# HU-CIT-01 — Reserva de citas

## Contrato y puesta en marcha

Aplicar las migraciones con `pnpm --filter medisur-system-backend migration:run` y actualizar los permisos base con `pnpm --filter medisur-system-backend seed`. No se ejecutan automáticamente sobre bases existentes. El catálogo incorpora `appointment.create` para PATIENT; se requiere también una cuenta activa con perfil PATIENT. Los permisos se validan con los guards existentes. La identidad del paciente proviene exclusivamente de la sesión.

`POST /api/appointments` recibe `{ "idSchedule": 9, "expectedVersion": 1 }`. Devuelve el sobre REST habitual con identificador de cita, paciente, médico, especialidad, horario, fecha, horas, zona `America/La_Paz` y estado `RESERVED`. Los datos de la cita se obtienen del horario persistido; no se aceptan identidad, estado, fecha ni horas decididos por el cliente. La disponibilidad incluye `version`, para detectar cambios entre consulta y confirmación.

La reserva ocupa el bloque completo publicado en EPIC-03: no se introduce una duración de consulta ni se generan turnos derivados. El flujo se encuentra en Dashboard → Disponibilidad médica, reutilizando los selectores de especialidad y médico activos, el calendario y la paginación común de TASK-API-01.

## Integridad y concurrencia

La transacción bloquea primero el médico y después el horario, en el mismo orden que la edición de horarios y la asignación de especialidades. Después del bloqueo vuelve a validar disponibilidad, versión, relaciones activas y fecha/hora con el reloj de PostgreSQL. La restricción `UQ_appointments_schedule` impide dos citas sobre el mismo bloque incluso si otro escritor omite el servicio. Los conflictos devuelven 409; un horario inexistente devuelve 404; una cuenta sin perfil de paciente activo devuelve 403.

La disponibilidad excluye citas antes del conteo/paginación mediante `NOT EXISTS`. La edición de horarios bloquea únicamente aquellos que tienen una cita; se conservan las revisiones y las relaciones históricas. La cita guarda las asociaciones y una copia de fecha/horas para trazabilidad.

`RESERVED` expresa una reserva confirmada, sin afirmar pago realizado ni notificación enviada. El identificador persistido y el límite transaccional permiten integrar posteriormente pagos y notificaciones por referencia a la cita y después del commit. Esas integraciones quedan fuera de esta HU. No se implementan cancelación ni liberación de bloques: una futura HU deberá adaptar la política de ocupación y la unicidad según sus estados, conservando el historial.

## Pruebas

Las pruebas HTTP verifican autenticación, permiso, validación del DTO e identidad no falsificable. Las pruebas frontend verifican confirmación explícita, bloqueo de doble clic, éxito, conflicto, error de red, permiso de reserva y actualización de disponibilidad.

Las pruebas reales de base de datos requieren `APPOINTMENTS_TEST_DATABASE_URL` apuntando a un PostgreSQL de pruebas y se ejecutan con `pnpm --filter medisur-system-backend test appointments.postgres --runInBand`. Crean y eliminan un esquema aislado aleatorio; nunca utilizan `DATABASE_URL`. Sin esa variable, esta suite se omite de forma explícita. Comprueban la migración de citas, reserva correcta, duplicados, ocho peticiones concurrentes, horarios inexistentes/inactivos/pasados, relaciones no elegibles, versión obsoleta y exclusión de horarios ocupados. La CI existente no configura esta variable; debe proporcionarse para ejecutar allí la suite PostgreSQL.

## Archivos de la implementación

- `apps/api/src/app.module.ts`
- `apps/api/src/common/types/availability.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/migrations/1792450000000-CreateAppointments.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/dtos/appointments/create-appointment.dto.ts`
- `apps/api/src/entities/appointments/appointment.entity.ts`
- `apps/api/src/modules/appointments/appointments.module.ts`
- `apps/api/src/modules/schedules/schedules.module.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/api/src/services/schedules/availability.spec.ts`
- `apps/api/src/services/schedules/schedules-update.spec.ts`
- `apps/api/src/services/schedules/schedules.service.ts`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/types/availability.ts`
- `apps/web/src/views/schedules/AppointmentBooking.test.tsx`
- `apps/web/src/views/schedules/AppointmentBooking.tsx`
- `apps/web/src/views/schedules/AvailabilitySlots.tsx`
- `apps/web/src/views/schedules/MedicalAvailability.test.tsx`
- `apps/web/src/views/schedules/MedicalAvailability.tsx`
- `docs/horarios.md`
- `docs/hu-cit-01-reserva.md`

## Verificación local

- `pnpm lint`: backend y frontend sin errores.
- `pnpm format`: backend y frontend correctos.
- `pnpm build`: backend y frontend exitosos, con comprobación TypeScript y generación de páginas.
- Suite backend completa con `APPOINTMENTS_TEST_DATABASE_URL`, `--runInBand` y caché temporal local: 51 suites, 536 pruebas correctas, incluidas las 13 pruebas reales de PostgreSQL.
- Suite frontend completa con directorio temporal local: 43 archivos, 290 pruebas correctas.
- La restricción del entorno impedía conexiones HTTP locales y ciertas operaciones en la carpeta temporal del sistema; las pruebas HTTP/PostgreSQL y el build se ejecutaron con permisos ampliados, sin modificar las configuraciones del proyecto.
- CI remota no ejecutada desde esta tarea. Migración y seed pendientes de aplicar en el entorno de destino; la validación PostgreSQL se realizó en un esquema temporal aislado.

Integración posterior HU-CIT-05: la unicidad permite conservar citas canceladas y una nueva reserva del mismo bloque. Solo las citas no canceladas ocupan el horario; véase [Cancelación de citas](hu-cit-05-cancelacion.md).
