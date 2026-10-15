# TASK-UI-03 — Landing pública, fases 1, 2 y 3

La ruta `/` pertenece al grupo `(blank-layout-pages)` y reutiliza su `BlankLayout` y su única instancia de `Providers`, igual que `/login` y `/register`. Ya no redirige al dashboard. `/dashboard` conserva su layout protegido sin cambios.

La vista `apps/web/src/views/landing` contiene navbar, hero, contenido principal y footer. Usa Material UI, el logo existente, el selector de modo y el theme de MEDISUR. La navegación horizontal aparece desde `lg`; en tablet y mobile se utiliza un Drawer. El hero pasa a dos columnas desde `md`. Los botones se apilan en mobile.

Los anchors `especialidades`, `como-funciona`, `especialistas`, `preguntas-frecuentes` y `contacto` tienen secciones destino únicas. Navbar y footer comparten estos enlaces. No se han agregado páginas legales inexistentes.

La referencia Figma es `YoSYGLQODgWlw5izmk51ct`, nodo `6560:26`. Se consultó su captura como guía de composición; no se incorporó código ni assets de Landify. Al no existir un mockup propio aprobado en los assets locales, el hero utiliza un panel decorativo con el logo actual, oculto para tecnologías de asistencia. Puede reemplazarse por un asset aprobado en `HeroSection`.

El mockup definitivo sigue pendiente de aprobación y no bloquea el contenido de fase 2.

## Fase 2 — Necesidad de lecturas públicas (decisión previa al backend)

EPIC-02 no ofrece endpoints anónimos: `/specialties`, `/doctors`, `/doctors/selection-specialties` y `/doctors/by-specialty/:id` requieren sesión y permisos. El listado administrativo de médicos contiene correo, CI e identificadores de cuenta, por lo que no debe hacerse público.

Se necesitan dos adaptaciones mínimas de lectura, sin nuevos módulos ni cambios a guards, permisos o autenticación:

- `GET /api/specialties/public?page=1&limit=8`: reutiliza el catálogo activo de `SpecialtiesService` y proyecta solo `idSpecialty` y `name`.
- `GET /api/doctors/public?page=1&limit=6`: reutiliza `DoctorsService.getAll` con estado activo forzado (perfil, cuenta y rol DOCTOR activos) y proyecta solo `idDoctor`, `name`, `lastname` y especialidades activas (`idSpecialty`, `name`). No devuelve datos administrativos ni personales de contacto.

Ambas rutas utilizan el decorador `Public` existente, `PaginationQueryDto`, el paginador y el envelope existentes. Aceptan únicamente paginación; `status`, búsqueda y otros parámetros no pueden habilitar registros inactivos. Los IDs sirven como claves de renderizado y no se muestran al visitante. Los endpoints privados permanecen protegidos.

El frontend hará estas consultas desde el servidor, sin cookies ni tokens, con timeout y fallos independientes. Se extienden los servicios de dominio existentes, sin usar el cliente administrativo Axios para estas lecturas: su interceptor de 401 redirige al login y no corresponde a una landing anónima. La información editorial no necesita endpoints.

## Renderizado y comportamiento de fase 2

`Landing` es un Server Component que compone las secciones. `LandingDataSections` carga cada catálogo dentro de su propio `Suspense`; las dos peticiones pueden resolverse independientemente sin bloquear el resto del contenido. `publicRead` realiza consultas anónimas con `credentials: omit`, sin caché para reflejar desactivaciones, y timeout de 5 segundos. Se conserva `NEXT_PUBLIC_API_URL`; no se agregan variables de entorno.

`CatalogSections` presenta especialidades (máximo 8, cuatro columnas desde lg, dos desde sm, una en mobile) y profesionales (máximo 6, tres columnas desde md, dos desde sm, una en mobile). El tamaño mínimo de los bloques se conserva durante carga para reducir saltos. Los errores tienen mensajes públicos genéricos y se recuperan al actualizar la página. Los catálogos vacíos tienen mensajes específicos y no afectan las demás secciones. Sin rutas de catálogo público completo, no se muestran acciones «Ver todos».

Los profesionales usan `CustomAvatar` existente con iniciales porque el contrato actual no tiene fotografías. El modelo de especialidades solo define nombre y estado; el criterio público reutiliza el mismo estado activo que la selección operativa de EPIC-02. Los perfiles se validan con el criterio existente de perfil, cuenta y rol DOCTOR activos. Se muestran solo sus especialidades activas; si no tienen asignaciones activas, se muestra únicamente su nombre.

`InformationalSections` contiene los cuatro pasos (cuenta, especialidad, médico, cita) y los cuatro beneficios aprobados. Los pasos aclaran que el módulo de reservas sigue pendiente. `FaqSection` contiene las cinco preguntas aprobadas, usa Accordion de MUI con una sola pregunta abierta, encabezados h3 y controles estables. La FAQ distingue funciones previstas de funciones disponibles; el formulario heredado de recuperación no tiene un endpoint de recuperación, por lo que no se promete envío automático por correo.

Se utilizan fondos, textos, divisores, colores y breakpoints del theme existente, sin cambios globales. Los anchors usan navegación nativa y no se agrega animación de scroll. La fase 2 no incluyó CTA final, mapa, ubicación, WhatsApp ni reserva de citas; el cierre visual y contacto se incorporan en fase 3.

## Pruebas y pendientes

Las pruebas cubren consultas limitadas sin credenciales, fallos independientes, estados de carga/error/vacío, proyección pública, criterios operativos, paginación, validación HTTP anónima y protección de endpoints privados, pasos, beneficios, anchors y expansión/cierre de FAQ.

Pendientes editoriales: aprobar un mockup propio del hero y ajustar textos de disponibilidad cuando el módulo de citas y la recuperación de contraseña estén realmente implementados.

### Archivos de fase 2

Frontend, nuevos:

- `apps/web/src/views/landing/CatalogSections.tsx`
- `apps/web/src/views/landing/LandingDataSections.tsx`
- `apps/web/src/views/landing/InformationalSections.tsx`
- `apps/web/src/views/landing/FaqSection.tsx`
- `apps/web/src/views/landing/ContentSections.test.tsx`
- `apps/web/src/views/landing/FaqSection.test.tsx`
- `apps/web/src/services/http/publicRead.ts`
- `apps/web/src/services/http/publicRead.test.ts`

Frontend, actualizados: `Landing.tsx`, `Landing.test.tsx` y `navigation.ts` en la misma carpeta de vistas; `services/doctors/doctorsService.ts`, `services/specialties/specialtiesService.ts` y `types/doctors.ts` bajo `apps/web/src`.

Backend, nuevo: `apps/api/src/controllers/doctors/public-catalog.http.spec.ts`.

Backend, actualizados bajo `apps/api/src`: `common/types/doctor-selection.type.ts`, `controllers/doctors/doctors.controller.ts`, `controllers/specialties/specialties.controller.ts`, `services/doctors/doctors.service.ts`, `services/doctors/doctors-selection.spec.ts`, `services/specialties/specialties.service.ts` y `services/specialties/specialties.service.spec.ts`.

Documentación: este archivo. Se conservan los cambios de fase 1 que ya estaban sin commit.

### Verificación local

El 15 de octubre de 2026 pasaron lint, formato y builds de ambas aplicaciones. La suite completa pasó con 180 pruebas frontend y 255 backend; tras los ajustes finales de tipos, se repitieron las 16 pruebas de landing/lecturas públicas y el build, exitosos. `git diff --check` pasó. El build conserva el aviso preexistente de datos antiguos de `baseline-browser-mapping`.

En navegador se revisaron datos reales locales, carga mediante Suspense, desktop de 1440 px, tablet de 768 px y mobile de 375 px, anchors y menú móvil, tema claro/oscuro, FAQ con Enter/Espacio y navegación pública. No hubo overflow horizontal en los anchos comprobados. Vacíos y errores se verificaron mediante pruebas automatizadas; no se alteraron registros reales para simularlos. El entorno local tenía una especialidad y un profesional publicados; no se crearon datos ficticios para completar la grilla.

## Fase 3 — Cierre funcional y pulido

Orden final: navbar, hero, especialidades, cómo funciona, especialistas, beneficios, FAQ, CTA final, contacto y footer.

`FinalCtaSection` muestra «Agenda tu atención médica de forma sencilla» sobre el mismo navy del footer y un botón secundario verde «Crear una cuenta» hacia `/register`. El texto aclara que las reservas en línea todavía no están habilitadas.

`ContactSection` muestra información confirmada directamente por el responsable del proyecto durante esta tarea:

- Dirección: **Av. Murillo Nro. 77**.
- Teléfono: **62-45655**, con enlace `tel:6245655` sin inventar un prefijo internacional.
- Mapa oficial compartido: <https://maps.app.goo.gl/zw1hVJUyy7e5hBHh6>.

La configuración está centralizada en `apps/web/src/configs/institutionalContact.ts`. No hay correo ni horarios confirmados y esos campos no se renderizan. Si en otro entorno se retiran los datos, la sección admite información parcial o un placeholder explícito sin contactos ficticios.

El iframe utiliza la URL obtenida en el diálogo oficial «Compartir → Incorporar un mapa» del enlace proporcionado. No se dedujeron coordenadas, no se requiere una clave API ni se agregó un SDK. Tiene título accesible, tamaño reservado y responsive, `loading="lazy"` y `referrerPolicy="strict-origin-when-cross-origin"`. Se conserva un enlace externo independiente, con aviso de nueva pestaña y `noopener noreferrer`, para abrir la ubicación aunque el embed no cargue. La apariencia interna del mapa la controla Google y se mantiene legible en ambos modos, sin invertir sus colores.

**Diferencia en la ficha externa:** al verificar el enlace, Google mostraba Av. Murillo 73 y el teléfono 74246284. El contenido institucional de la landing conserva los datos confirmados por el usuario (77 y 62-45655); corresponde conciliar la ficha de Google por separado. No se copiaron sus horarios, valoraciones ni otros datos a la landing.

`landingStyles.ts` concentra una escala local de secciones de 40 px en mobile y 64 px desde md, calculada por el spacing existente. Se redujeron las alturas mínimas excesivas de los catálogos sin retirar sus estados de carga. Los botones y controles principales tienen áreas de al menos 44 px. El Drawer incorpora nombre accesible y foco visible; al pasar a desktop se cierra y libera el bloqueo de scroll y el foco. Se respetan preferencias de movimiento reducido en la landing y en el Drawer mediante CSS local. No cambian el theme ni los estilos globales.

La metadata se define exclusivamente en la página `/`: título «MEDISUR | Centro Médico de Especialidades» y descripción institucional moderada. Se conservan `lang="es"`, los iconos existentes y los providers públicos. `Landing` sigue siendo Server Component, los catálogos mantienen sus dos consultas acotadas e independientes y el mapa solo se solicita al acercarse a contacto. No se añadieron dependencias ni APIs de negocio y no hubo cambios backend adicionales en fase 3.

### Archivos de fase 3

Nuevos bajo `apps/web/src`: `configs/institutionalContact.ts`, `views/landing/ContactSection.tsx`, `views/landing/FinalCtaSection.tsx`, `views/landing/landingStyles.ts` y `views/landing/ClosingSections.test.tsx`.

Actualizados: `app/(blank-layout-pages)/page.tsx`; dentro de `views/landing`, `Landing.tsx`, `Landing.test.tsx`, `LandingNavbar.tsx`, `LandingFooter.tsx`, `navigation.ts`, `CatalogSections.tsx`, `InformationalSections.tsx` y `FaqSection.tsx`; además de este documento. Se conservan los cambios anteriores sin commit.

### Verificación final de TASK-UI-03

Lint, formato, build de ambas aplicaciones y `git diff --check` correctos. Suite completa: **186 pruebas frontend (30 archivos)** y **255 backend (34 suites)** aprobadas. Se ejecutaron las tareas existentes de pruebas mediante Turborepo con `--maxWorkers=2`, sin deshabilitar controles ni modificar la configuración, tras agotar la memoria del entorno en una primera ejecución simultánea de checks. El build conserva el aviso previo de antigüedad de `baseline-browser-mapping`.

Se recorrieron navbar, todos los anchors, FAQ con teclado, CTA hacia registro, retorno a `/`, acceso al login, contacto y footer en desktop (1440), tablet (768) y mobile (375). Se revisaron ambos modos de color, carga real del mapa, un único h1, ausencia de anchors muertos y de overflow horizontal, y cierre del menú al ampliar el viewport. Se comparó la composición con la referencia Figma ya consultada: se conserva la jerarquía y distribución sin copiar assets ni código de Landify. Errores y vacíos de los catálogos mantienen cobertura automatizada; no se alteraron registros reales.

No quedan assets de Landify, textos demo ni contactos inventados en el contenido de producción. El panel propio del hero continúa como visual temporal pendiente de un mockup aprobado. Los avatares de iniciales son el fallback previsto por ausencia de fotografías en el contrato actual. No se realizó commit, push, PR ni merge.
