## 1. Propósito

Este repositorio contiene el sistema web MEDISUR, desarrollado como Proyecto de Grado.

El sistema tiene como objetivo gestionar citas médicas, historiales clínicos, usuarios, médicos especialistas, horarios, pagos, notificaciones, reportes y auditoría.

Los agentes que trabajen sobre este repositorio deben respetar la arquitectura, convenciones, herramientas y patrones existentes antes de introducir nuevas implementaciones.

---

## 2. Estructura del repositorio

El proyecto utiliza un monorepo con Turborepo.

Estructura principal:

```text
apps/
├── web/    # Frontend
└── api/    # Backend

docs/       # Documentación técnica y del proyecto
```

No crear nuevos proyectos, aplicaciones o paquetes sin una necesidad técnica justificada.

La carpeta `packages/` no forma parte actualmente de la estructura utilizada.

---

## 3. Stack tecnológico

### Frontend

- React
- Next.js
- TypeScript
- Material UI
- Materio como base visual del dashboard

### Backend

- NestJS 10
- TypeScript
- API REST

### Base de datos

- PostgreSQL

### Infraestructura y herramientas

Herramientas presentes en las dependencias y configuraciones del repositorio:

- Turborepo
- pnpm 10.33.0 (`packageManager` en `package.json` y `pnpm-lock.yaml`)
- Docker / Docker Compose
- Redis y BullMQ
- Husky
- Commitlint
- Commitizen
- ESLint
- Prettier
- GitHub Actions y semantic-release
- Jest en backend y Vitest en frontend

Antes de modificar configuraciones existentes, revisar cómo están utilizadas actualmente.

---

## 4. Regla principal de trabajo

Antes de implementar una Issue:

1. Leer completamente la Issue.
2. Revisar este `AGENTS.md`.
3. Analizar el código existente relacionado.
4. Revisar entidades, DTOs, servicios, controladores, rutas y permisos existentes.
5. Revisar componentes, hooks, servicios e interfaces existentes en frontend.
6. Revisar pruebas existentes.
7. Reutilizar patrones y componentes actuales cuando exista una solución equivalente.
8. Evitar implementaciones paralelas o duplicadas.
9. Realizar únicamente los cambios necesarios para cumplir la Issue.

No asumir que una funcionalidad debe desarrollarse desde cero.

---

## 5. Código heredado/reutilizado

MEDISUR parte de una base técnica proveniente de otro proyecto.

Ya pueden existir implementaciones funcionales de:

- autenticación;
- usuarios;
- roles;
- permisos;
- autorización;
- guards;
- decorators;
- paginación;
- Redis;
- Docker;
- CI/CD;
- Husky;
- lint;
- formatting;
- tests;
- componentes compartidos del frontend.

Estas implementaciones deben reutilizarse y adaptarse siempre que sean compatibles con MEDISUR.

Eliminar o modificar únicamente aquello que pertenezca exclusivamente al dominio anterior.

No reimplementar autenticación, roles o permisos sin demostrar que la implementación existente es insuficiente.

---

## 6. Roles del sistema

Los roles base de MEDISUR son:

- `SUPERADMIN`
- `STAFF`
- `DOCTOR`
- `PATIENT`

El sistema está diseñado principalmente con autorización basada en permisos.

Evitar validaciones rígidas como:

```ts
if (user.role === 'SUPERADMIN')
```

cuando exista un permiso específico que represente la operación.

Preferir:

```text
rol
↓
permisos
↓
funcionalidad
```

El frontend puede ocultar acciones sin permiso, pero esto nunca sustituye la validación de autorización en backend.

---

## 7. Seguridad

MEDISUR maneja información médica sensible.

Toda implementación debe considerar:

- principio de mínimo privilegio;
- validación de autorización en backend;
- protección de información clínica;
- validación de entradas;
- manejo seguro de credenciales;
- no exponer información sensible en logs;
- integridad de datos;
- trazabilidad de operaciones relevantes.

`SUPERADMIN` no implica automáticamente acceso al contenido clínico de los pacientes.

El acceso a historiales clínicos debe depender de permisos y reglas de negocio específicas.

---

## 8. Arquitectura

Mantener la arquitectura modular existente.

El backend distribuye actualmente su código entre `apps/api/src/modules`, `controllers`, `services`, `dtos`, `entities`, `core`, `common` y `database`; los nombres siguientes son dominios previstos, no una lista de carpetas existentes.

El backend distribuye actualmente su código entre `apps/api/src/modules`, `controllers`, `services`, `dtos`, `entities`, `core`, `common` y `database`; los nombres siguientes son dominios previstos, no una lista de carpetas existentes.

### Backend

Los módulos de dominio previstos incluyen:

```text
auth
users
roles
permissions
specialties
doctors
patients
schedules
appointments
medical-records
payments
notifications
reports
audit
```

No es obligatorio que todos existan desde el inicio.

Crear módulos únicamente cuando la Issue o arquitectura los requiera.

### Frontend

Reutilizar:

- layout de Materio;
- tema existente;
- componentes compartidos;
- tablas;
- paginación;
- formularios;
- dialogs;
- guards;
- sistema de permisos;
- servicios HTTP;
- patrones de loading/error;
- hooks existentes.

No modificar el diseño global de Materio innecesariamente.

---

## 9. Base de datos

Antes de crear una nueva entidad:

1. Revisar entidades existentes.
2. Revisar relaciones existentes.
3. Confirmar que no exista otra entidad que represente el mismo concepto.
4. Evaluar impacto sobre migraciones y datos existentes.

Evitar eliminación física de información que requiera trazabilidad histórica.

Cuando corresponda, preferir:

- estado activo/inactivo;
- soft delete;
- historial de cambios.

Mantener integridad referencial.

---

## 10. APIs

Mantener las convenciones REST existentes del backend.

Antes de agregar un endpoint:

- revisar endpoints similares;
- revisar formato de respuestas;
- revisar manejo de excepciones;
- revisar DTOs;
- revisar validaciones;
- revisar autorización.

No crear endpoints redundantes si uno existente puede extenderse razonablemente.

---

## 11. Frontend

Antes de crear un componente nuevo:

1. Buscar un componente reutilizable.
2. Revisar componentes compartidos.
3. Revisar patrones ya utilizados en otras páginas.
4. Mantener consistencia con Material UI y Materio.

No crear estilos o componentes alternativos que rompan la coherencia visual sin necesidad.

Mantener:

- responsive design cuando corresponda;
- estados de loading;
- estados vacíos;
- manejo de errores;
- feedback al usuario.

---

## 12. Historias de usuario e Issues

Cada Issue debe cumplirse de acuerdo con sus criterios de aceptación.

No ampliar el alcance de una Issue sin necesidad.

Si durante la implementación se identifica una necesidad adicional importante que no pertenece a la Issue:

- no implementarla silenciosamente;
- documentarla;
- proponer una nueva Issue.

Las historias de usuario siguen identificadores como:

```text
HU-USR-XX
HU-MED-XX
HU-HOR-XX
HU-CIT-XX
HU-HCL-XX
HU-PAG-XX
HU-NOT-XX
HU-REP-XX
HU-AUD-XX
```

---

## 13. Sprints

El desarrollo está organizado inicialmente en cuatro sprints:

### Sprint 1 — Base del sistema

- autenticación;
- usuarios;
- roles;
- permisos;
- médicos;
- especialidades.

### Sprint 2 — Horarios y citas

- horarios médicos;
- disponibilidad;
- reservas;
- cancelaciones;
- reprogramaciones.

### Sprint 3 — Atención e historial clínico

- atención médica;
- historial clínico;
- acceso clínico;
- controles de seguridad relacionados.

### Sprint 4 — Integraciones y estabilización

- pagos;
- notificaciones;
- reportes;
- auditoría;
- pruebas;
- correcciones;
- estabilización.

Al finalizar el Sprint 4 debe existir un MVP funcional que cubra mínimamente los alcances definidos para MEDISUR.

---

## 14. Git y ramas

Ramas principales:

```text
main
test
dev
```

El desarrollo de funcionalidades debe partir normalmente de `dev`.

Usar ramas descriptivas, por ejemplo:

```text
feat/hu-cit-01-book-appointment
feat/hu-hcl-01-register-encounter

fix/appointment-double-booking

test/appointment-service

docs/update-requirements

chore/update-docker-config
```

No realizar cambios directos en `main` salvo que el flujo del repositorio lo permita explícitamente.

---

## 15. Commits

El proyecto utiliza Conventional Commits, validado por Commitlint, y Commitizen mediante `pnpm commit`. Los hooks de Husky ejecutan `pnpm precommit` (lint-staged y lint), `pnpm prepush` (build y test) y Commitlint en `commit-msg`.

Ejemplos:

```text
feat(appointments): add appointment booking endpoint

fix(auth): prevent inactive user login

test(records): add medical record access tests

docs(requirements): update appointment requirements

refactor(users): reuse existing pagination service
```

Mantener commits enfocados y descriptivos.

---

## 16. Calidad

Antes de considerar una Issue terminada, verificar como mínimo:

- criterios de aceptación cumplidos;
- lint correcto;
- format correcto;
- pruebas correspondientes exitosas;
- build exitoso;
- CI exitoso cuando aplique;
- ausencia de errores críticos conocidos.

No deshabilitar pruebas, lint, hooks o controles de CI para hacer que una implementación pase.

Corregir la causa del error.

Los scripts de la raíz delegan en Turborepo: `pnpm lint`, `pnpm format`, `pnpm test` y `pnpm build`. `pnpm lint:fix` y `pnpm format:fix` aplican correcciones. Para ejecutar scripts de una aplicación, usar `pnpm --filter medisur-system-backend <script>` o `pnpm --filter medisur-system-frontend <script>`; `api` y `web` son nombres de carpetas, no los nombres de los paquetes.

El script raíz `check-types` existe, pero ninguna aplicación define actualmente ese script. Los scripts de lint del frontend invocan `next lint`; su presencia no garantiza que funcionen con la versión declarada de Next.js. La CI configura Node.js 24.14.1 y pnpm 10.33.0, y ejecuta instalación con `--frozen-lockfile`, lint, test y build; no ejecuta `format`.

Los scripts de la raíz delegan en Turborepo: `pnpm lint`, `pnpm format`, `pnpm test` y `pnpm build`. `pnpm lint:fix` y `pnpm format:fix` aplican correcciones. Para ejecutar scripts de una aplicación, usar `pnpm --filter medisur-system-backend <script>` o `pnpm --filter medisur-system-frontend <script>`; `api` y `web` son nombres de carpetas, no los nombres de los paquetes.

El script raíz `check-types` existe, pero ninguna aplicación define actualmente ese script. Los scripts de lint del frontend invocan `next lint`; su presencia no garantiza que funcionen con la versión declarada de Next.js. La CI configura Node.js 24.14.1 y pnpm 10.33.0, y ejecuta instalación con `--frozen-lockfile`, lint, test y build; no ejecuta `format`.

---

## 17. Pruebas

Agregar o actualizar pruebas cuando el cambio afecte lógica relevante.

Priorizar especialmente pruebas para:

- autenticación;
- autorización;
- permisos;
- disponibilidad;
- conflictos de citas;
- acceso a historiales clínicos;
- pagos;
- reglas de negocio sensibles.

No considerar suficiente únicamente una prueba manual cuando ya exista infraestructura automatizada adecuada.

---

## 18. Documentación

Actualizar documentación cuando una modificación cambie:

- arquitectura;
- variables de entorno;
- endpoints;
- modelo de datos;
- permisos;
- instalación;
- ejecución;
- infraestructura.

La documentación académica/técnica puede almacenarse bajo:

```text
docs/
```

No agregar documentación innecesaria por cada cambio menor.

---

## 19. Restricciones importantes del proyecto

Mantener los límites definidos para MEDISUR:

- no implementar biometría para autenticación;
- no integrar identidad externa;
- no interoperar con historiales de otros centros médicos;
- los horarios son registrados por los médicos;
- el sistema no selecciona automáticamente citas por el paciente;
- WhatsApp se utiliza para notificaciones definidas, no como chatbot;
- la integración de pagos se limita al mecanismo definido para el proyecto;
- los reportes se limitan a los contemplados por el alcance.

No ampliar estos límites sin una Issue o decisión explícita.

---

## 20. Antes de finalizar una tarea

El agente debe informar:

1. archivos modificados;
2. comportamiento implementado;
3. decisiones técnicas relevantes;
4. pruebas ejecutadas;
5. resultados de lint/build/test;
6. limitaciones o pendientes encontrados;
7. cualquier desviación de la Issue original.

No declarar una funcionalidad completada si existen criterios de aceptación pendientes.
