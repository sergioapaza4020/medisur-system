# HU-CIT-03 — Consultar mis citas

## API y permisos

`GET /api/appointments/mine` requiere una sesión vigente y `appointment.get-mine`. El permiso se incorpora al catálogo y al rol PATIENT con el seed existente: `pnpm --filter medisur-system-backend seed`. Renovar la sesión después de actualizar permisos. La política general del seed también lo incorpora a SUPERADMIN; este endpoint sigue mostrando exclusivamente las citas de la cuenta autenticada, sin excepción por rol.

No admite una identidad de paciente como entrada. Parámetros adicionales como `idPatient` o `idUser` se descartan por el ValidationPipe existente; no alteran el predicado obligatorio de paciente aplicado en SQL antes del conteo y la paginación. No se agrega una consulta administrativa de citas ajenas ni un endpoint de detalle por identificador.

Parámetros:

- `page` y `limit`: infraestructura de TASK-API-01; valores por defecto 1 y 10, límite máximo 100.
- `period`: `upcoming` (por defecto), `past` o `all`.
- `status`: opcional, validado con el enum de citas existente; `RESERVED`, `CANCELLED` y `RESCHEDULED` (estos dos últimos reconocidos para lectura desde HU-CIT-04).
- `date`: opcional, fecha civil exacta `AAAA-MM-DD`, validada estrictamente y sin año cero.

Los filtros se combinan mediante AND. Las próximas tienen inicio mayor o igual al momento actual; las anteriores ya comenzaron. Esta clasificación no afirma que la atención haya concluido ni cambia el estado de la cita. La comparación utiliza PostgreSQL y `America/La_Paz`. Las próximas se ordenan de más cercana a más lejana; las anteriores, de más reciente a más antigua. El identificador de cita desambigua empates para mantener paginación estable.

Se conserva el sobre REST habitual `{ data, meta, ... }`. Cada registro expone únicamente `idAppointment`, `doctor: { name, lastname }`, `specialty: { name }`, `date`, `startTime`, `endTime`, `status` y `timeZone`. No se devuelven identificadores de paciente, cuentas completas, documentos, correos, auditoría, información clínica ni datos de pagos.

Las citas históricas mantienen su visibilidad aunque el médico, su cuenta o la especialidad se hayan desactivado o eliminado lógicamente. Se usan los nombres conservados en esas relaciones y las fechas/horas guardadas en la cita. Las citas eliminadas lógicamente quedan excluidas. No se requiere una migración de base de datos.

## Frontend

Ruta `/dashboard/appointments`, enlace «Mis citas» visible con el permiso de consulta. Reutiliza Materio, la tabla existente, los servicios HTTP y `ListPagination`, con `PaginationQuery`, `PaginationMeta` y `PaginatedResponse<T>` comunes. La vista presenta médico, especialidad, fecha, intervalo y estado en español; permite seleccionar periodo, estado y fecha.

Cambiar filtros reinicia la página. La paginación conserva los filtros. Mientras carga se ocultan resultados anteriores; las respuestas obsoletas no sobrescriben la selección vigente. Si cambia la cuenta autenticada, se ocultan inmediatamente los datos de la cuenta anterior y se vuelve a consultar. Incluye error con reintento, estado vacío y recuperación si una página deja de existir. No se agregan acciones de cancelación, reprogramación ni acceso a contenido clínico.

## Pruebas

- SQL/proyección: paciente obligatorio, filtros parametrizados, orden estable, paginación común, ausencia de datos sensibles y página vacía.
- HTTP: autenticación, permiso específico, validación de filtros/paginación, descarte de identidades falsificadas y ausencia de acceso por identificador de otro paciente.
- PostgreSQL real: dos pacientes con citas diferentes, aislamiento de resultados y totales, filtros de fecha/estado/periodo, paginación y conservación del historial con relaciones inactivas o eliminadas lógicamente. Se amplía la suite PostgreSQL existente de citas.
- Frontend: permiso, campos mostrados, filtros, reinicio y conservación de paginación, loading sin datos anteriores, error con reintento, estado vacío, respuestas obsoletas y recuperación de página.

La suite PostgreSQL usa `APPOINTMENTS_TEST_DATABASE_URL`, crea un esquema aleatorio aislado y lo elimina al terminar. Nunca usa `DATABASE_URL`; sin la variable, esa suite se omite explícitamente como en HU-CIT-01. La CI existente no configura la variable y debe recibirla para ejecutar esa cobertura real.

## Archivos de esta HU

- `apps/api/src/common/types/patient-appointment.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/dtos/appointments/appointments-query.dto.ts`
- `apps/api/src/services/appointments/appointments-mine.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/web/src/app/dashboard/appointments/page.tsx`
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/types/appointments.ts`
- `apps/web/src/views/appointments/MyAppointments.test.tsx`
- `apps/web/src/views/appointments/MyAppointments.tsx`
- `docs/hu-cit-03-mis-citas.md`

## Verificación local

- Backend: 52 suites, 551 pruebas correctas; incluye HTTP local y las 15 pruebas de PostgreSQL real de la suite de citas ampliada.
- Frontend: 44 archivos, 303 pruebas correctas, incluidas las de filtros, aislamiento visual por cuenta y paginación.
- Checks: `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check`.
- Se utilizó una instancia temporal de PostgreSQL, con la variable de pruebas y esquema aislado. No se modificaron datos de la base de MEDISUR.
- El primer build frontend falló por una conexión a Google Fonts al obtener Manrope. El reintento completo pasó sin modificar el tema ni la infraestructura.
- CI remota pendiente de ejecutar. En destino, actualizar permisos mediante el seed existente. No hay migraciones nuevas ni cambios de arquitectura, providers o tema global.
