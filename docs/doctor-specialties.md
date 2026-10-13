# HU-MED-03 — Asignar especialidades a un médico

Desde el listado de médicos, «Asignar especialidades» abre las asignaciones actuales y el catálogo activo paginado. La selección se conserva al cambiar de página. Se pueden agregar varias especialidades, retirar asociaciones y guardar la configuración completa. Se muestran carga, errores con reintento, catálogo vacío y confirmación de guardado.

## API y autorización

| Método | Ruta                       | Permiso                     | Comportamiento                                                                 |
| ------ | -------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/doctors/:id/specialties` | `doctor.assign-specialties` | Devuelve el médico y todas sus asignaciones actuales, incluidas las inactivas. |
| PUT    | `/doctors/:id/specialties` | `doctor.assign-specialties` | Reemplaza las asignaciones con `{ specialtyIds: number[] }`.                   |

El cuerpo exige IDs enteros positivos, únicos y hasta 100. `[]` retira todas las asignaciones, dejando el perfil pendiente de configuración, como permite el registro existente. El autor se obtiene de la sesión. El catálogo requiere `specialty.get-all`; la interfaz exige ambos permisos. El seeder incorpora `doctor.assign-specialties` a SUPERADMIN y STAFF, respetando permisos deshabilitados y personalizados. Renovar la sesión tras ejecutar el seeder.

## Integridad e historial

Se reutiliza la relación muchos-a-muchos `doctor_specialty` y su clave primaria compuesta. Una especialidad puede pertenecer a varios médicos. Para agregar asociaciones se exige perfil y cuenta activos, rol DOCTOR activo y especialidades existentes activas. Las asignaciones existentes inactivas pueden conservarse o retirarse; una vez retiradas, solo podrán agregarse de nuevo si están activas.

El reemplazo se ejecuta en una transacción con bloqueo del médico y validación de las nuevas especialidades antes de escribir. Una solicitud idéntica no crea eventos ni asociaciones duplicadas. Registro inicial y modificaciones escriben eventos en `doctor_specialty_history`, con fecha, autor y alta/retiro. Sus claves foráneas restringen la eliminación física del médico y la especialidad. No hay endpoints para editar o borrar eventos. Si falla la escritura del historial, también se revierte la configuración.

La migración conserva la tabla de asignaciones actual y registra una instantánea de las asociaciones existentes en la fecha de aplicación, sin inventar fechas ni autores anteriores. Retirar una asociación elimina únicamente su disponibilidad actual; no elimina médico, especialidad ni historial. Todavía no existen módulos de citas o atenciones en el repositorio. Al incorporarlos, sus referencias históricas deben apuntar al médico y especialidad o a un evento persistente, nunca depender de la tabla de disponibilidad actual. Las consultas operativas existentes siguen excluyendo médicos y especialidades inactivos.

## Aplicación

Aplicar `pnpm --filter medisur-system-backend migration:run` (incluye `DoctorSpecialtyHistory1791820000000`) y luego `pnpm --filter medisur-system-backend seed`. Se requiere haber aplicado las migraciones de HU-MED-01 y HU-MED-02. Revertir esta migración descarta el historial, aunque conserva las asignaciones actuales; no revertirla en entornos con trazabilidad que se deba conservar.

Las pruebas cubren reemplazo, múltiples médicos, duplicados, permisos HTTP, DTOs, estados inactivos, conservación de asociaciones inactivas, eventos transaccionales, idempotencia, fallos de persistencia y selección paginada con feedback en frontend. La aplicación real de la migración requiere PostgreSQL; los tests con repositorios simulados no sustituyen esa comprobación.
