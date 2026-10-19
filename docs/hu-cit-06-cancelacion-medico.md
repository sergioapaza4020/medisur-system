# HU-CIT-06 — Cancelar cita como médico

## Reglas y alcance

El médico autenticado con perfil activo puede cancelar únicamente una cita asociada a su perfil. Se reutiliza la transacción de cancelación del paciente: cita activa, no eliminada, en estado RESERVED y cuyo inicio aún no haya ocurrido según el reloj PostgreSQL en America/La_Paz. Se exige siempre un motivo de 1 a 500 caracteres después de quitar espacios exteriores, porque esta operación responde a una situación extraordinaria.

La transición es RESERVED → CANCELLED. No se elimina ni sobrescribe la cita histórica; se conservan paciente, médico, especialidad, fecha y horas originales. Se registran actor y fecha de cancelación, motivo y origen DOCTOR, junto con updated_by. Las cancelaciones nuevas del paciente registran origen PATIENT, sin exigir motivo. Las cancelaciones anteriores conservan sus datos y las nuevas columnas quedan nulas: no se inventa auditoría histórica.

El bloque se libera para reserva normal cuando continúa cumpliendo las reglas existentes de disponibilidad: futuro, horario y perfiles activos y asociaciones vigentes. No queda retenido para reprogramación automática ni se desactiva al médico o su horario. La reprogramación posterior podrá crear una nueva cita conservando la cancelación original.

## API y autorización

`PATCH /api/appointments/:idAppointment/cancel-as-doctor`

Cuerpo: `{ "reason": "Situación extraordinaria" }`.

Requiere autenticación y permiso específico `appointment.cancel-as-doctor`. El catálogo lo asigna a DOCTOR y, por la política existente, a SUPERADMIN. Ambos necesitan un perfil médico activo y solo pueden operar sobre sus propias citas. STAFF, PATIENT y el permiso de lectura de agenda no conceden esta acción. No se acepta identidad de médico, paciente o actor en el cuerpo como autoridad: se usa la sesión y el perfil vinculado.

La respuesta mantiene el formato habitual con idAppointment, status CANCELLED y cancelledAt. Entradas inválidas devuelven 400, ausencia de autenticación 401, falta de permiso/perfil activo 403, cita inexistente/eliminada/de otro médico 404 y estado/fecha incompatibles 409. No se exponen datos clínicos ni campos de auditoría en los listados. El paciente afectado ve el estado y el motivo registrado a través de «Mis citas», exclusivamente en su consulta propia.

La consulta inicial y la actualización se limitan al perfil propio. El servicio vuelve a comprobar el perfil después de esperar los bloqueos. Se mantiene el orden médico → horario → cita y la actualización condicionada por estado y hora, de modo que dos cancelaciones simultáneas no pueden sobrescribir actor, fecha ni motivo de la primera. El índice único parcial existente sigue protegiendo nuevas reservas del bloque.

## Modelo e integración posterior con EPIC-07

La migración 1792630000000-DoctorAppointmentCancellation añade cancellation_reason y cancellation_source, con restricciones que exigen estado CANCELLED, motivo, actor y fecha cuando el origen es DOCTOR. La entidad declara las mismas restricciones. La reversión retira estas columnas; debe gestionarse según la política del entorno para conservar previamente la auditoría necesaria.

El punto de integración duradero de EPIC-07 es la cancelación confirmada en appointments, con cancellation_source = DOCTOR. La fila conserva id_appointment, id_patient, id_doctor, snapshots de fecha/horas, cancelled_at, cancelled_by y cancellation_reason en la misma transacción. El módulo futuro podrá leer este contexto únicamente después del commit y usar id_appointment como clave de la cancelación para su control de envío. No debe publicar desde dentro de una transacción que todavía pueda revertirse ni incluir datos clínicos innecesarios. EPIC-07 implementará la entrega, reintentos y registro de envío; esta HU no promete notificaciones ya enviadas ni incorpora colas/providers nuevos.

## Frontend

La agenda conserva el calendario y sus filtros existentes. Su resumen de cita incorpora «Cancelar cita» solo con el permiso correspondiente, estado RESERVED e inicio futuro. Reutiliza CancelAppointment con modo médico, resumen del paciente, motivo obligatorio y confirmación explícita. Impide doble envío y cierre de la confirmación durante la solicitud. Los errores recuperables mantienen el motivo para reintentar; los conflictos y el éxito recargan la agenda sin cambiar fecha, vista o filtros. Se presenta feedback y se ocultan mensajes de otra cuenta.

No se introduce paginación ni se modifican el calendario, la infraestructura compartida de TASK-API-01, la arquitectura, el tema global o providers.

## Puesta en marcha y verificación

En destino: aplicar `pnpm --filter medisur-system-backend migration:run`, actualizar el catálogo con `pnpm --filter medisur-system-backend seed` y renovar la sesión. No se ejecutan estos comandos contra la base de MEDISUR durante esta tarea.

Las pruebas cubren permisos HTTP, DTO y protección de identidad, propiedad médica, perfil inactivo, estados incompatibles, motivo, trazabilidad, migración, liberación del horario, nueva reserva, visibilidad del paciente y concurrencia entre paciente y médico. El frontend cubre confirmación, motivo, endpoint, errores y acción por permiso con recarga y conservación del periodo.

La suite real de PostgreSQL utiliza APPOINTMENTS_TEST_DATABASE_URL y crea un esquema aislado. Sin la variable se omite como en las HU anteriores; su ejecución en CI requiere proporcionar esa base de pruebas. No se cambia la infraestructura de CI en esta HU. La ejecución remota de CI queda pendiente de publicación.

## Archivos modificados o creados

- `apps/api/src/controllers/appointments/appointments.controller.ts`
- `apps/api/src/controllers/appointments/appointments.http.spec.ts`
- `apps/api/src/database/migrations/1792630000000-DoctorAppointmentCancellation.ts`
- `apps/api/src/database/seeders/access-control.catalog.ts`
- `apps/api/src/database/seeders/access-control.seeder.spec.ts`
- `apps/api/src/database/seeders/access-control.seeder.ts`
- `apps/api/src/dtos/appointments/cancel-doctor-appointment.dto.ts`
- `apps/api/src/entities/appointments/appointment.entity.ts`
- `apps/api/src/services/appointments/appointments-cancel.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/web/src/services/appointments/appointmentsService.test.ts`
- `apps/web/src/services/appointments/appointmentsService.ts`
- `apps/web/src/views/appointments/CancelAppointment.test.tsx`
- `apps/web/src/views/appointments/CancelAppointment.tsx`
- `apps/web/src/views/appointments/DoctorAgenda.test.tsx`
- `apps/web/src/views/appointments/DoctorAgenda.tsx`
- `docs/hu-cit-06-cancelacion-medico.md`

## Resultados locales

- Backend: 54 suites y 656 pruebas correctas, incluidas las pruebas reales de PostgreSQL, con `pnpm --filter medisur-system-backend test --runInBand --cacheDirectory D:/uatf/sis940/medisur-system/node_modules/.cache/cit06-jest` y APPOINTMENTS_TEST_DATABASE_URL apuntando al servidor temporal aislado.
- Frontend: 47 archivos y 351 pruebas correctas con `pnpm --filter medisur-system-frontend test` y directorios TEMP/TMP locales para la caché.
- `pnpm lint`: correcto en ambas aplicaciones, sin errores ni advertencias de ESLint.
- `pnpm format`: correcto en ambas aplicaciones.
- `pnpm build`: correcto en ambas aplicaciones.
- `git diff --check`: correcto.
- La base PostgreSQL temporal fue detenida y eliminada después de terminar las pruebas. La base de MEDISUR no se utilizó.
- Pendiente en destino: aplicar la nueva migración, actualizar permisos y renovar la sesión. CI remota no ejecutada desde esta tarea; la cobertura PostgreSQL requiere configurar la variable de pruebas existente.
- Sin ampliaciones a cancelación administrativa, reprogramación, pagos o envío de notificaciones. La entrega de notificaciones corresponde a EPIC-07.

## Corrección: motivo visible para el paciente

El motivo ya se persistía en `Appointment.cancellationReason` (`cancellation_reason`) mediante `CancelDoctorAppointmentDto.reason` y `cancelAsDoctor()`. La consulta SQL y el mapper de `AppointmentsService.mine()` lo omitían, por lo que nunca llegaba al frontend.

`GET /api/appointments/mine` incorpora `cancellationReason: string | null` a su proyección mínima. Devuelve el valor existente solo si el estado es CANCELLED, y null para los demás estados o datos históricos sin motivo. Conserva el filtro obligatorio por idUser de la sesión. No devuelve cancellationSource, cancelledBy, auditoría, notas internas ni objetos completos del médico/usuario. No hay endpoints, columnas ni migraciones nuevas en esta corrección; no cambia validación, persistencia, permisos o reglas de cancelación.

El tipo PatientAppointment de frontend declara el campo opcional y nullable para tolerar respuestas anteriores. MyAppointments lo muestra debajo de «Cancelada» con el título «Motivo de cancelación», mediante Stack y Typography de MUI, con ajuste de línea y texto completo, sin tooltip ni recorte. Para null, undefined, vacío o espacios, muestra «No se registró un motivo de cancelación». No aparece ningún bloque en citas activas o reprogramadas, incluso si una respuesta inconsistente contiene texto. React representa el motivo como texto, sin interpretar HTML.

La consulta del paciente es el listado `/dashboard/appointments`; no existe una vista de detalle independiente para extender. El motivo completo queda visible directamente en cada fila cancelada. No se altera la agenda del médico.

Archivos de esta corrección:

- `apps/api/src/common/types/patient-appointment.type.ts`
- `apps/api/src/services/appointments/appointments.service.ts`
- `apps/api/src/services/appointments/appointments-mine.spec.ts`
- `apps/api/src/services/appointments/appointments.postgres.spec.ts`
- `apps/web/src/types/appointments.ts`
- `apps/web/src/views/appointments/MyAppointments.tsx`
- `apps/web/src/views/appointments/MyAppointments.test.tsx`
- `docs/hu-cit-06-cancelacion-medico.md`

Verificación de la corrección:

- Backend: 54 suites, 660 pruebas correctas; incluye PostgreSQL real temporal, validación obligatoria del médico, persistencia, motivo devuelto al paciente afectado, ausencia en consulta ajena, proyección segura y null en otros estados.
- Frontend: 47 archivos, 360 pruebas correctas; cubre motivo corto/largo completo, null/undefined/vacío/espacios, estado visible, ausencia del bloque en otros estados y escape de HTML.
- `pnpm lint`, `pnpm format`, `pnpm build` y `git diff --check`: correctos en ambas aplicaciones. No se deshabilitaron controles.
- Navegador: revisión del componente real con sesión y citas ficticias, comprobando el listado con motivos corto y largo, cancelación histórica sin motivo y cita activa sin bloque. El texto completo queda accesible en el listado; no hay detalle independiente. La integración de cancelación/persistencia/consulta se comprobó mediante PostgreSQL temporal y pruebas HTTP, sin utilizar la base operativa.
- La vista previa y PostgreSQL temporal se detuvieron al finalizar. CI remota no ejecutada. Se preservaron los cambios previos de HU-CIT-06; sin commit, push, PR ni merge. Sin desviaciones funcionales respecto a esta corrección.
