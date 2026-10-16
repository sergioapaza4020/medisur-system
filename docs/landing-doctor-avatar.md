# Corrección de foto de médico en landing pública

## Causa y flujo corregido

La imagen corresponde al avatar de `Doctor.user`, no al usuario que visita la
landing. La configuración de cuenta persiste una key administrada en `User.avatar`.
El catálogo público reutilizaba `getAll`, cuya proyección administrativa descartaba
esa key. Además, la card de especialistas renderizaba únicamente iniciales sin src.

Se conserva la consulta compartida, paginación y elegibilidad existente: médico,
cuenta y rol DOCTOR activos, con especialidades activas. La consulta se separa de
su proyección administrativa para que la proyección pública pueda leer el avatar
del usuario relacionado sin añadirlo a respuestas administrativas.

El flujo queda:

`User.avatar → Doctor.user → DoctorsService.getPublicPage → avatarUrl →
GET /api/doctors/public → doctorsService.publicPage → SpecialistsDataSection →
SpecialistsSection → CustomAvatar.src`.

`PublicDoctor` incorpora exclusivamente `avatarUrl`, nullable. No se publican email,
documento, IDs de usuario, roles, permisos ni auditoría. No se crean endpoints.

## Storage, fallback y caché

Se reutiliza `avatarUrl` de backend, que valida la key mediante
`StorageService.getPublicUrl` y obtiene la URL pública con el provider Neon existente.
DoctorsModule importa StorageModule; no se modifican Storage, provider, subida,
configuración de cuenta, autenticación ni permisos. No se hardcodean URLs de imagen
en código de producción ni se consulta la cuenta del visitante.

La card conserva CustomAvatar/MUI y las iniciales como children. Sin foto, ante una
referencia heredada no administrada o al fallar la carga se muestran iniciales.
Se utiliza alt con el nombre del médico y object-fit cover, manteniendo 80×80 px.
No es necesario modificar next.config porque no se utiliza next/image.

El lector público ya usa `cache: no-store`, sin cookies; se conserva ese contrato.
Storage ya genera UUID diferentes al reemplazar una imagen, por lo que una lectura
posterior recibe otra URL. No se desactiva caché global ni se implementa polling.

## Archivos de esta corrección

- `apps/api/src/common/types/doctor-selection.type.ts`
- `apps/api/src/modules/doctors/doctors.module.ts`
- `apps/api/src/services/doctors/doctors.service.ts`
- `apps/api/src/services/doctors/doctors.service.spec.ts`: adaptación de inyección.
- `apps/api/src/services/doctors/doctors-selection.spec.ts`
- `apps/api/src/controllers/doctors/public-catalog.http.spec.ts`
- `apps/web/src/types/doctors.ts`
- `apps/web/src/views/landing/CatalogSections.tsx`
- `apps/web/src/views/landing/ContentSections.test.tsx`
- Este documento.

Otros cambios en el árbol de trabajo corresponden a las tareas previas de esta
conversación y se conservaron sin commit.

## Verificación

Backend: pruebas de URL por médico, ausencia de foto, referencia inválida, cambio
de key, proyección pública mínima, proyección administrativa sin avatar y contrato
HTTP anónimo. Storage está simulado; no hay escrituras reales en Neon.

Frontend: foto de cada médico, null/undefined, cambio de URL y propagación desde
el servicio de datos de la landing. Se conserva la prueba de no renderizar datos
privados aunque aparezcan campos adicionales en una respuesta simulada.

Resultados: 457 pruebas backend en 45 suites y 249 frontend en 37 archivos, todas
exitosas. Lint, format y build pasan en ambas aplicaciones. Permanece el aviso
preexistente de baseline-browser-mapping. No se ejecuta CI remota.

Comprobación real, solo lectura: el catálogo local devolvió cinco médicos sin foto
y uno con foto; la URL de Neon respondió sin credenciales con 200 e image/jpeg.
La landing mostró la imagen correspondiente y las iniciales restantes. Se
comprobaron escritorio 1440×900, tablet 768×1024 y móvil 390×844: imagen cargada,
80×80 px, cover y sin desborde horizontal. El reemplazo y URL rota se verifican en
una vista temporal que utiliza el componente real con imágenes sintéticas, sin
modificar cuentas ni imágenes reales.

No se realizan commit, push, PR ni merge.
