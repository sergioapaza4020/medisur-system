# Registro de horarios (HU-HOR-01)

- Aplicar la migración `1792190000000-CreateSchedules` mediante el flujo existente de migraciones y ejecutar el seed de control de acceso. El permiso `schedule.create` se asigna al rol DOCTOR; sigue administrándose mediante permisos existentes.
- `POST /schedules`: cuerpo `{ "idSpecialty": 1, "date": "2026-11-02", "startTime": "09:00", "endTime": "12:00" }`. Requiere autenticación y `schedule.create`. El médico se obtiene exclusivamente de la sesión, incluso para SUPERADMIN. No se incorpora una excepción administrativa para registrar horarios ajenos.
- `GET /schedules/specialties?page=1&limit=10`: especialidades activas del médico autenticado, con paginación común de TASK-API-01 y proyección mínima.
- Formulario: `/dashboard/schedules/register`, accesible desde el menú según permiso.
- Modelo de bloques por fecha concreta, sin recurrencia. El día se deriva de la fecha y no se almacena duplicado. Fecha y horas representan tiempo civil de `America/La_Paz`, sin conversiones implícitas a UTC. No se permiten bloques nocturnos que crucen de día; registrar un bloque para cada fecha.
- Inicio estrictamente anterior al fin; intervalos adyacentes permitidos. Se rechazan solapamientos activos del mismo médico, incluso entre especialidades diferentes. Una transacción con bloqueo del médico serializa registros concurrentes y cambios de asignación de especialidades. No se eliminan horarios ni se almacena disponibilidad derivada.
- Requiere perfil, cuenta y rol médico activos, y especialidad activa asignada. No incluye consulta de horarios, modificación, disponibilidad ni citas de otras historias.
