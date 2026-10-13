# HU-MED-04 — Consultar médicos por especialidad

La ruta `/dashboard/doctors/by-specialty` permite seleccionar una especialidad activa y consultar sus médicos con paginación común. La disponibilidad indica perfil, cuenta y rol DOCTOR activos; no representa turnos libres ni permite reservar citas.

## API reutilizable

Ambos endpoints requieren sesión y el permiso `doctor.get-by-specialty`, sin permisos administrativos adicionales:

- `GET /doctors/selection-specialties?page=1&limit=10`: catálogo activo, limitado a `idSpecialty` y `name`.
- `GET /doctors/by-specialty/:idSpecialty?page=1&limit=10`: médicos asociados, limitado a `idDoctor`, `name` y `lastname`.

La consulta usa `DoctorsService.getBySpecialty()` y puede reutilizarse desde horarios y citas. Primero valida la especialidad con `SpecialtiesService.getActiveById()`. Una especialidad inexistente o inactiva devuelve 400 según el patrón vigente. Una especialidad activa sin médicos devuelve 200 con `data: []` y metadatos válidos. La consulta exige asociación actual, perfil y cuenta activos y rol DOCTOR activo; las entidades eliminadas lógicamente se excluyen por TypeORM.

Se utilizan `PaginationQueryDto`, `PaginatedResult<T>` y `paginate()` en backend, y `PaginationQuery`, `PaginatedResponse<T>` y `ListPagination` en frontend. Página mínima 1 y límite entre 1 y 100. No se ofrece un filtro administrativo de estado y no se exponen correo, documento, identificador de cuenta, roles, permisos ni auditoría. La interfaz conserva la especialidad al paginar médicos, reinicia la página al cambiarla y maneja carga, errores con reintento y resultados vacíos. Las respuestas de solicitudes obsoletas se ignoran.

## Permisos y aplicación

El seeder añade exclusivamente la consulta operativa a PATIENT y STAFF; SUPERADMIN recibe el permiso mediante el catálogo existente. DOCTOR y roles personalizados requieren asignación explícita si corresponde. No se amplía el acceso de PATIENT al catálogo administrativo de especialidades ni al listado administrativo de médicos. Se mantienen permisos personalizados y capacidades deshabilitadas al repetir el seeder.

Ejecutar `pnpm --filter medisur-system-backend seed` y renovar la sesión para incorporar el nuevo permiso. No hay cambios de modelo ni nuevas migraciones en esta HU; se requieren las dependencias HU-MED-01 a HU-MED-03 aplicadas.

Las pruebas cubren autorización, identificadores y paginación inválidos, especialidades inexistentes/inactivas, resultados vacíos, filtrado operativo, respuesta mínima, permisos del seeder y estados e interacción del frontend.
