# HU-USR-01 — Iniciar sesión en MEDISUR

## Implementación y reutilización

Se conserva la autenticación existente con NestJS, Passport/JWT, bcrypt, sesiones,
usuarios, roles y permisos. El login utiliza el nombre de usuario existente; no se
introduce otro identificador, proveedor de identidad o mecanismo de autenticación.

En frontend se reutilizan el cliente único services/http/axiosClient.ts, sus opciones
NEXT_PUBLIC_API_URL + /api y withCredentials, las utilidades authCookies y el helper
getApiErrorMessage. El interceptor que tenía la renovación pendiente ahora completa
ese flujo en la misma instancia. Todas las llamadas de autenticación de la interfaz
se realizan mediante services/auth/authService.ts.

No había un contexto de usuario autenticado ni un guard frontend. Se añade AuthGuard
únicamente al layout de /dashboard, con useAuth para acceder al usuario y consultar
permisos. No se modifican Providers, el tema global, la arquitectura del backend,
las entidades, migraciones, dependencias o infraestructura de ejecución.

## Flujo de acceso

1. El formulario conserva Materio/MUI y el diseño MEDISUR existente. Solicita usuario
   y contraseña, valida campos vacíos, muestra progreso, evita envíos repetidos y usa
   mensajes del backend mediante getApiErrorMessage.
2. POST /api/auth/login verifica un usuario activo y el hash bcrypt. Usuario inexistente,
   inactivo o contraseña incorrecta reciben 401 con el mismo mensaje:
   `Credenciales inválidas`.
3. El backend devuelve accessToken, refreshToken y metadatos mínimos de sesión
   (idSession y expiresAt). No devuelve el hash de contraseña, hash de refresh o una
   entidad de sesión completa. Cada login genera un refresh distinto.
4. El frontend guarda únicamente los tokens con las utilidades existentes y obtiene
   GET /api/auth/me antes de redirigir a /dashboard. No persiste contraseñas ni el perfil
   en localStorage/sessionStorage. El contexto conserva el perfil en memoria.
5. El layout redirige a /login si no hay cookies de autenticación. La presencia de una
   cookie no autentica: AuthGuard consulta /auth/me y solo muestra el dashboard cuando
   el backend confirma la sesión. Un error de conectividad muestra un estado de error
   con reintento, sin mostrar el contenido protegido.
6. El contexto recupera usuario, roles activos y permisos efectivos; revalida en cambios
   de ruta y al volver a enfocar la ventana. Los permisos siguen verificándose en API.

Los controles de Google/Facebook se retiran del login porque la identidad externa está
fuera del alcance de MEDISUR. Registro y recuperación de contraseña mantienen sus
rutas existentes y corresponden a sus propias historias.

## Tokens y sesiones

Se conserva el almacenamiento en cookies del cliente ya elegido por el proyecto:
accessToken y refreshToken, path=/, sameSite=strict y secure en producción. Sin
Recuérdame las cookies son de sesión del navegador; al seleccionarlo el refresh tiene
persistencia de siete días. El backend conserva el límite de sesión de siete días y
las expiraciones JWT configuradas mediante JWT_ACCESS_SECRET_EXPIRES_IN y
JWT_ACCESS_REFRESH_EXPIRES_IN. No se cambia el contrato de variables de entorno.

Ante un 401 de un recurso protegido, el interceptor intenta renovar el access token
con POST /api/auth/refresh-access-token y reintenta la petición una sola vez. Varias
peticiones concurrentes comparten una renovación. Login y refresh quedan excluidos
del reintento para evitar bucles. Un 403 mantiene la sesión y entrega el error al
consumidor, incluso si sucede después de una renovación exitosa.

Si la renovación falla o el token renovado vuelve a ser rechazado, se eliminan las
cookies y se redirige a /login. Una renovación pendiente no restaura credenciales
eliminadas por logout. Los resultados obsoletos de /auth/me tampoco restauran el
contexto tras cerrar sesión.

En cada petición autenticada el backend valida el JWT, la identidad y pertenencia de
la sesión, su vigencia y estado activo, y el usuario activo. Después carga roles y
permisos efectivos mediante el mecanismo existente. Una cuenta deshabilitada, sesión
revocada o sesión expirada recibe 401; una sesión válida sin permisos recibe 403.

## Cerrar sesión

El menú muestra el usuario real. Su acción invoca POST /api/sessions/logout con el
refresh token, revoca la sesión correspondiente y elimina los tokens y el estado
local. Logout no puede revocar la sesión de otro usuario. La sesión revocada rechaza
inmediatamente tanto access como refresh. Si la API no está disponible, se elimina
igualmente el estado local y se vuelve a /login; la revocación remota no puede
confirmarse en ese caso y el token remoto conserva su expiración original.

## Pruebas

- HTTP backend con controladores, JWT, guards, servicios de autenticación/sesiones,
  validación e interceptor de respuesta reales. La persistencia utiliza dobles en
  memoria: login válido, credenciales inválidas, usuario inexistente/inactivo, usuario
  actual, capacidades, 401/403, refresh, logout, expiración, deshabilitación posterior
  y sesiones simultáneas.
- Pruebas de servicios para identidad de sesión incompleta y logout de otro usuario.
- Frontend con la instancia Axios y los interceptores reales, adaptador HTTP controlado
  y cookies simuladas: tokens, login, sesión actual, refresh concurrente, errores,
  403 tras refresh, reintento limitado, logout y renovación tardía.
- Render frontend y layout: campos de acceso y estilo MUI, ausencia de identidad externa,
  redirect sin autenticación y contenido protegido oculto hasta validar la sesión.
- vitest.config.mts reutiliza los alias de las rutas del proyecto para ejecutar estas
  pruebas; no afecta la configuración de producción.

Comandos de verificación: pnpm lint, pnpm format, pnpm test, pnpm build.
La comprobación adicional de tipos backend usa
pnpm --filter medisur-system-backend exec tsc --noEmit --incremental false.

La CI remota debe confirmarse al publicar la rama; las verificaciones locales no
constituyen una ejecución de GitHub Actions. No se realizan cambios a otros módulos.

## Resultados de verificación local

- pnpm test: 54 pruebas backend (21 suites) y 13 frontend (3 archivos), todas exitosas.
- pnpm lint: sin errores; cuatro advertencias previas en componentes Materio no modificados.
- pnpm format: correcto en ambas aplicaciones.
- Compilación backend: correcta.
- Compilación frontend estándar con Next.js 16.0.4/Turbopack: correcta. El primer intento
  falló por una descarga temporal de Manrope; el reintento pasó sin cambiar tema,
  fuentes, dependencias ni configuración.
- Tipos frontend y backend, incluidas pruebas: correctos.
- git diff --check: correcto.
- CI remota: pendiente de publicación y ejecución. No se crearon commits ni PR.

## Archivos modificados o incorporados

- `apps/api/src/common/test-mocks/sessions.mock.ts`
- `apps/api/src/controllers/auth/auth.http.spec.ts`
- `apps/api/src/dtos/auth/login.dto.ts`
- `apps/api/src/services/auth/auth.service.spec.ts`
- `apps/api/src/services/auth/auth.service.ts`
- `apps/api/src/services/sessions/sessions.service.spec.ts`
- `apps/api/src/services/sessions/sessions.service.ts`
- `apps/web/src/app/dashboard/layout.test.tsx`
- `apps/web/src/app/dashboard/layout.tsx`
- `apps/web/src/components/auth/AuthGuard.tsx`
- `apps/web/src/components/layout/shared/UserDropdown.tsx`
- `apps/web/src/services/auth/authService.test.ts`
- `apps/web/src/services/auth/authService.ts`
- `apps/web/src/services/http/axiosClient.ts`
- `apps/web/src/types/auth.ts`
- `apps/web/src/utils/http/authCookies.ts`
- `apps/web/src/utils/http/getApiErrorMessage.ts`
- `apps/web/src/views/pages/auth/Login.test.tsx`
- `apps/web/src/views/pages/auth/Login.tsx`
- `apps/web/vitest.config.mts`
- `docs/hu-usr-01-login.md`
