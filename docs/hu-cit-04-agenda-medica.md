# HU-CIT-04 — Consultar agenda médica

## Acceso y alcance

`GET /api/appointments/agenda` requiere autenticación y `appointment.get-agenda`. El seed existente concede el permiso a DOCTOR y, conforme a su política actual, SUPERADMIN. El backend exige además un perfil médico, cuenta y rol DOCTOR activos y no eliminados, reutilizando la validación de SchedulesService. Un administrador sin perfil médico activo obtiene 403, incluso con el permiso.

El médico se obtiene exclusivamente de la sesión. Parámetros como `idDoctor`, `idUser` o `idPatient` se descartan por el ValidationPipe habitual y no cambian el alcance. La consulta filtra el identificador del médico antes de paginar y contar. No se añade una excepción administrativa ni un permiso para agendas ajenas.

Actualizar permisos mediante `pnpm --filter medisur-system-backend seed`. No hay nuevas migraciones, módulos, providers ni cambios de tema o infraestructura.

## Filtros y paginación

Se acepta una fecha exacta `date=AAAA-MM-DD` o el par `from`/`to`, inclusivo y de hasta 31 días. No se admite combinar ambos modos, invertir el rango, omitir un extremo, consultar sin fecha/rango ni usar fechas imposibles, año cero o timestamps. Se reutilizan los validadores de fechas de AvailabilityQueryDto mediante PickType y la validación de rango de SchedulesService. La vista inicia con el día actual de Bolivia.

`status` es opcional. `page` y `limit` reutilizan PaginationQueryDto, PaginatedResult<T> y paginate(), con valores iniciales 1 y 10 y máximo 100 por página. El orden es fecha, hora inicial e identificador de cita ascendentes para mantener resultados estables.

Ejemplos:

- `/api/appointments/agenda?date=2026-11-02&page=1&limit=10`
- `/api/appointments/agenda?from=2026-11-01&to=2026-11-30&status=CANCELLED&page=1&limit=10`

Los filtros se combinan mediante AND. No se excluyen automáticamente citas por estado ni por estar en el pasado. Se excluyen las citas eliminadas lógicamente, conservando la identificación de pacientes y especialidades de citas históricas aunque esas relaciones se hayan desactivado o eliminado lógicamente.

## Proyección y estados

La respuesta conserva el sobre REST `{ data, meta, ... }`. Cada cita incluye únicamente identificador de cita, paciente `{ name, lastname, ci }`, especialidad `{ name }`, fecha, hora inicial/final, estado y `timeZone: America/La_Paz`. El documento permite confirmar la identidad del paciente. No se devuelven cuentas completas, identificador del paciente, correos, contraseñas, permisos, auditoría, pagos ni contenido clínico.

El modelo previo solo declaraba RESERVED. Esta HU reconoce también CANCELLED y RESCHEDULED para lectura y filtros, y reutiliza las etiquetas compartidas en frontend. En la agenda se muestran «Reservada», «Cancelada» y «Reprogramada», con indicadores visuales azul primario, error y advertencia del tema existente, además del texto para no depender únicamente del color. La columna de estado es varchar, por lo que no requiere migración.

No se implementan operaciones que cambien una cita a cancelada o reprogramada. Esas operaciones corresponden a sus HU y deberán definir trazabilidad, relación entre citas y liberación de ocupación. La política actual de reservas y su restricción única siguen vigentes. Los registros con esos estados se pueden consultar y distinguir sin anticipar esas reglas de negocio.

## Frontend

Vista `/dashboard/appointments/agenda`, enlace «Mi agenda médica» según permiso. Reutiliza la tabla y estilos de Materio, servicio HTTP, manejo de errores, boliviaToday() y ListPagination con PaginationQuery, PaginationMeta y PaginatedResponse<T> comunes.

Permite alternar entre fecha y rango sin combinar parámetros incompatibles, filtrar por estado, conservar filtros al paginar y reiniciar la página al cambiarlos. Presenta carga sin datos anteriores, error con reintento, agenda vacía y recuperación de una página que deja de existir. Descarta respuestas obsoletas y oculta inmediatamente los resultados de la cuenta anterior si cambia la sesión.

## Pruebas

Se añaden pruebas HTTP de autenticación, permiso, descarte de identificadores ajenos, validación de fechas/rangos, estados y paginación. Las pruebas SQL comprueban alcance y proyección mínima, orden, rango máximo, rechazo de rangos ambiguos y perfil médico activo.

La suite PostgreSQL existente se amplía con dos médicos y sus citas, aislamiento de resultados y totales, consulta por fecha/rango/estado, paginación, estados cancelada/reprogramada, pacientes eliminados lógicamente, exclusión de citas eliminadas y denegación por perfil, cuenta o rol médico no elegibles. Las pruebas frontend cubren permisos, filtros, paginación, indicadores de estado, carga, error, vacío, respuestas obsoletas y cambio de cuenta.

La suite PostgreSQL usa `APPOINTMENTS_TEST_DATABASE_URL` y un esquema temporal aislado que elimina al finalizar; nunca usa DATABASE_URL. Sin esa variable se omite explícitamente la suite, según el patrón existente. La CI necesita recibirla para ejecutar esa cobertura real.

## Archivos modificados o creados

- `apps/api/src/common/types/doctor-appointment.type.ts`
- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/database/seeders/access-control.seeder.ts`
- `apps/api/src/dtos/appointments/doctor-agenda-query.dto.ts`
- `apps/api/src/entities/appointments/appointment.entity.ts`
- `apps/api/src/services/appointments/appointments-agenda.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/api/src/services/schedules/schedules.service.ts`
- `apps/web/src/app/dashboard/appointments/agenda/page.tsx`
- `apps/web/src/components/layout/vertical/VerticalMenu.tsx`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/types/appointments.ts`
- `apps/web/src/types/doctor-agenda.ts`
- `apps/web/src/views/appointments/DoctorAgenda.test.tsx`
- `apps/web/src/views/appointments/DoctorAgenda.tsx`
- `docs/hu-cit-03-mis-citas.md`
- `docs/hu-cit-04-agenda-medica.md`

## Resultado de verificación local

- Backend: 53 suites, 601 pruebas correctas, incluidas 33 pruebas reales de PostgreSQL, ejecutadas con `pnpm --filter medisur-system-backend test --runInBand`, la variable de pruebas y caché temporal local.
- Frontend: 46 archivos, 332 pruebas correctas mediante `pnpm --filter medisur-system-frontend test`, con directorio temporal local.
- `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check`: correctos.
- La validación real utilizó PostgreSQL temporal con esquema aislado, sin ejecutar migraciones ni seed sobre la base de MEDISUR.
- Pendiente en destino: actualizar permisos con el seed y verificar CI remota. La CI no se ejecutó desde esta tarea. No quedaron criterios funcionales de consulta pendientes; los cambios de estado se reservan a las HU de cancelación/reprogramación.
