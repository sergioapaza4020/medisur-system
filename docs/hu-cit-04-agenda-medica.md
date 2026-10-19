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

Integración posterior HU-CIT-05: las cancelaciones propias se realizan desde «Mis citas» y se reflejan en esta agenda como CANCELLED, conservando la fila y su auditoría. La reprogramación sigue fuera del alcance de estas HU.

## Evolución visual — Día, Semana y Mes

La página propia y el permiso se conservan. DoctorAgenda reutiliza el servicio HTTP, los filtros de estado, las etiquetas de cita, los controles MUI/Materio, errores con reintento y las utilidades de fecha de horarios. No consulta disponibilidad ni presenta espacios libres como citas. No hay dependencias nuevas ni cambios al dashboard, tema, creación de citas o historia clínica.

- Día: lista cronológica de citas con hora inicial/final, paciente, especialidad y estado.
- Semana: lunes a domingo, grilla horaria desde `md` del tema; por debajo, lista agrupada por día. El rango horario visible se deriva del mínimo inicio y máximo final de las citas recibidas, sin modificar las jornadas médicas. Las citas que se solapan, incluidas cancelaciones que comparten horario, se separan en columnas.
- Mes: consulta únicamente los días del mes (máximo 31), muestra totales y hasta dos citas por día en pantallas amplias, con «más». En pantallas estrechas muestra fecha y total. Seleccionar día cambia a Día.
- Vista inicial: Semana desde `md`; Día en teléfonos y tablets estrechas. Una selección explícita de vista se conserva al redimensionar.
- Anterior/Siguiente desplazan un día, siete días o un mes. Hoy conserva la vista. El selector de fecha y los cambios de vista mantienen la fecha de referencia. La navegación mensual ajusta días inexistentes al último día del mes.
- Detalle: diálogo operativo con paciente, especialidad, fecha, horas y estado. No muestra documento ni contenido clínico. Los estados utilizan colores del tema y etiquetas de texto.
- Hora actual: actualización cada minuto en Bolivia; indicador en Día y Semana si incluyen hoy. La línea semanal solo se dibuja dentro del rango horario visible.

### API de calendario

`GET /api/appointments/agenda?from=2026-10-01&to=2026-10-31&mode=calendar`

El DTO añade `mode=list|calendar` opcional. Sin modo o con `list`, se conserva la paginación anterior. Con `calendar` se devuelve el rango completo ordenado, en el mismo sobre `{data, meta}`; `page` y `limit` no recortan ese resultado. `meta` representa una página completa (cero páginas si está vacía). Esto evita requests por día y pérdida silenciosa de citas al superar 100 eventos. La validación inclusiva de hasta 31 días y el alcance por médico autenticado se aplican antes de ambas variantes. No se acepta un identificador de médico para ampliar el alcance.

El modo calendario omite también el documento del paciente en la consulta SQL y en la respuesta. El modo de lista conserva su proyección por compatibilidad. No se añaden entidades, migraciones, permisos ni datos clínicos a la respuesta.

### Fechas y reutilización

Se conserva America/La_Paz y `Intl` en español. Las fechas siguen siendo cadenas YYYY-MM-DD y las horas cadenas HH:mm:ss, sin convertirlas a instantes con toISOString. La aritmética de calendario usa mediodía UTC con getters UTC, siguiendo availabilityDates, para evitar que la zona del navegador cambie el día.

Para un futuro resumen «Agenda de hoy» se pueden reutilizar el servicio por rango y la presentación operativa de cita, manteniendo esta agenda como página independiente. No se implementa ese resumen en esta entrega.

### Verificación de esta evolución

- Backend: 54 suites y 631 pruebas correctas, incluidas 48 pruebas reales de PostgreSQL. Se ejecutó `pnpm --filter medisur-system-backend test --runInBand` con APPOINTMENTS_TEST_DATABASE_URL apuntando a una instancia temporal propia, exclusiva de pruebas, en localhost. Se verificaron aislamiento entre médicos, rangos diarios/semanales/mensuales, orden, validación, autorización HTTP, respuesta vacía y proyección sin documento ni datos clínicos en modo calendario. También se cubre un periodo con 105 eventos para comprobar que no se trunca.
- Frontend: 47 archivos y 347 pruebas correctas mediante `pnpm --filter medisur-system-frontend test`. La suite DoctorAgenda cubre vistas y defaults, navegación y Hoy, conservación de referencia, filtros, apertura de día/cita, estados, carga/error/reintento/vacío, respuestas obsoletas, cambio de cuenta, fecha correcta, límites de año/mes bisiesto y solapamientos.
- `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check`: correctos en ambas aplicaciones. El build conserva el aviso previo sobre antigüedad de baseline-browser-mapping; no bloquea la compilación y no se cambió esa dependencia.
- Revisión de navegador sobre el componente real con API y sesión ficticias: Día con varias citas y vacío; Semana con citas en varios días y vacía; Mes con totales, primeras citas y «más»; cambio de vistas, navegación, Hoy y detalle; estados reales; tamaños de escritorio (1280), tablet (1024) y móvil (390); temas claro y oscuro. Se verificó ausencia de desbordamiento horizontal en móvil y se corrigieron recortes de eventos y altura del resumen mensual detectados visualmente.
- La revisión visual utiliza fixtures, no una cuenta conectada a la base operativa. La integración de autorización y datos se verifica con pruebas HTTP y PostgreSQL. No se ejecutó CI remota. No se modificaron datos de la base del proyecto. La vista previa y PostgreSQL temporales se detuvieron al finalizar.
- La primera ejecución dentro del aislamiento falló por permisos de conexiones HTTP locales; la repetición con acceso local autorizado pasó. Vitest requirió un directorio temporal dentro del workspace por restricciones del entorno.
- No se hicieron commit, push, PR ni merge. Se conservaron los cambios locales anteriores de HU-CIT-05. No hay ampliaciones funcionales fuera del alcance solicitado.

### Archivos de esta evolución (incluye archivos con cambios previos conservados)

1. `apps/api/src/common/types/doctor-appointment.type.ts`
2. `apps/api/src/dtos/appointments/doctor-agenda-query.dto.ts`
3. `apps/api/src/services/appointments/appointments.service.ts`
4. `apps/api/src/services/appointments/appointments-agenda.spec.ts`
5. `apps/api/src/controllers/appointments/appointments.http.spec.ts`
6. `apps/api/src/services/appointments/appointments.postgres.spec.ts`
7. `apps/web/src/types/doctor-agenda.ts`
8. `apps/web/src/views/appointments/DoctorAgenda.tsx`
9. `apps/web/src/views/appointments/DoctorAgenda.test.tsx`
10. `apps/web/src/views/appointments/agendaDates.ts` (nuevo)
11. `docs/hu-cit-04-agenda-medica.md`
