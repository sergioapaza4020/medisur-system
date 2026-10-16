# Configuración de cuenta: menú y foto de perfil

## Estado revisado

Se leyó AGENTS.md y se revisaron el User Dropdown, AuthGuard, `/auth/me`,
`MyAccountService`, DTOs, entidad User, cliente HTTP, pruebas y el contrato de
Storage de #82. Los cambios previos de HU-USR-08 se conservaron en el árbol local.

El dropdown estaba en `apps/web/src/components/layout/shared/UserDropdown.tsx`,
obtenía usuario y logout desde `useAuth` y solo ofrecía cerrar sesión. Ahora muestra
Configuración de cuenta antes de logout, con el icono disponible `ri-settings-3-line`.
Navega a la ruta existente `/dashboard/account-settings`, cierra el menú y conserva
el manejo de teclado, foco y logout. No requiere permisos administrativos.

## Modelo y contrato HTTP

Se reutiliza `User.avatar`, columna varchar nullable ya existente, para guardar la
key estable. Se explicita `string | null` en TypeScript y el tipo varchar en el
decorador sin alterar el esquema. No hay migración ni uso de synchronize.

Las rutas llevan el prefijo `/api`:

| Ruta                      | Entrada                           | Respuesta                                              |
| ------------------------- | --------------------------------- | ------------------------------------------------------ |
| `POST /users/me/avatar`   | Multipart con un archivo `avatar` | `avatarUrl`, `cleanupPending`                          |
| `DELETE /users/me/avatar` | Ninguna                           | `avatarUrl: null`, `cleanupPending`                    |
| `GET /users/me`           | Ninguna                           | Datos personales, `avatarUrl`, política `avatarUpload` |
| `GET /auth/me`            | Ninguna                           | Sesión actual y URL de avatar resuelta en backend      |

La identidad procede exclusivamente de `@CurrentUser().idUser`. Multer acepta un
solo archivo, ningún campo de texto y aplica el límite configurado antes de cargar
el archivo completo en memoria. No se reciben IDs, keys, carpetas ni URLs como
destino. El PATCH de datos personales continúa con su allowlist y no permite
establecer avatar desde una URL. La API de subida está descrita como multipart en
Swagger. No se crea endpoint genérico de Storage.

## Reutilización de Neon Storage

UsersModule y AuthModule importan el StorageModule existente. Se reutilizan el
mismo StorageService, provider, cliente S3, bucket y credenciales. No se agrega
dependencia ni una segunda integración. El frontend no recibe secretos ni utiliza
el SDK.

StorageService sigue siendo autoridad de tamaño, MIME, firma, key y URL. El contexto
fijado por backend es `profiles`, generando `images/profiles/<uuid-v4>.jpg|png|webp`.
No se incorporan nombres, emails, documentos ni filenames del cliente en las keys.

Se admiten JPEG, PNG y WebP. Se utiliza `STORAGE_MAX_IMAGE_SIZE`, con valor
predeterminado 5242880 bytes (5 MiB). `getImagePolicy()` expone exclusivamente el
límite real y los MIME permitidos; el interceptor y el frontend consumen ese mismo
contrato. Las variables requeridas están presentes en el entorno local; no se
modificó ni imprimió su contenido privado.

La URL se deriva con el helper compartido de backend y `StorageService.getPublicUrl`.
Valores heredados que no sean keys administradas producen fallback y nunca se
devuelven como URLs externas arbitrarias. MUI Avatar usa `src`; no fue necesario
modificar Next config ni remotePatterns.

## Reemplazo y consistencia

Se amplía `StorageService.replace` con un callback opcional de persistencia, sin
romper los consumidores anteriores. El flujo es:

1. Leer la referencia anterior del usuario autenticado.
2. Validar y subir la nueva imagen con StorageService.
3. En una transacción breve, bloquear la fila activa y comprobar que la referencia
   anterior no cambió. Si cambió, devolver 409 y compensar la nueva subida.
4. Actualizar `avatar` y `updatedBy`, y confirmar la transacción.
5. Eliminar la imagen anterior con la operación existente de Storage.

Si falla la subida no se toca la referencia anterior. Si falla la persistencia, se
intenta eliminar únicamente la nueva key. Si falla el borrado anterior después de
confirmar la nueva referencia, el resultado sigue siendo exitoso con
`cleanupPending=true`. No se repite ciegamente la subida.

La edición de datos personales reutiliza UsersService.update con un EntityManager
opcional y el mismo bloqueo de fila, para que un guardado concurrente de perfil no
restaure una key antigua. La lógica administrativa de validación y duplicados sigue
en el servicio existente; no se duplica.

Eliminar foto requiere confirmación. Primero se confirma `avatar=null` en BD y luego
se intenta borrar el objeto anterior. Si Storage falla, se mantiene el fallback y
se informa limpieza pendiente. La operación sin imagen es idempotente. Desactivar
la cuenta conserva la imagen y no llama a Storage para eliminarla.

Storage es externo a PostgreSQL: no se promete atomicidad distribuida. Los fallos
de limpieza se registran con operación y key, sin credenciales ni datos personales.
No hay job de limpieza nuevo; revisar manualmente las keys pendientes sigue siendo
una limitación de la infraestructura existente. La firma de contenido no equivale
a decodificación o eliminación de EXIF, según el contrato de #82. Las fotos son
públicas y la interfaz lo informa antes de seleccionar.

## Interfaz y estado global

AccountPhoto incorpora Cambiar foto, input accesible, formatos/límite, carga,
errores, éxito y eliminación confirmada. La imagen se sube al seleccionar; no hay
preview que pueda confundirse con persistencia. El input se restablece para poder
seleccionar nuevamente el mismo archivo. Se bloquea doble envío.

AccountAvatar comparte imagen e iniciales entre configuración, botón del navbar y
cabecera del dropdown. AuthGuard expone una actualización parcial de presentación
que permite solamente nombre, apellido, email y avatarUrl; conserva identidad y
autorización. Una respuesta antigua de `/auth/me` no puede sobrescribir una foto
recién cambiada y una respuesta tardía no puede restaurar sesión después de logout.
No se exige recarga manual.

Los botones se ajustan en filas y el bloque pasa a columna en móvil. No se muestra
el filename, evitando desbordes por nombres largos. Se usan colores del tema,
Alert para errores y Dialog con título/descripción, foco inicial en Cancelar y
retorno de foco. No se cambia el tema global ni los flujos de login, registro o
recuperación.

## Archivos de esta ampliación

Backend:

- `apps/api/src/controllers/users/avatar-upload.interceptor.ts`
- `apps/api/src/controllers/users/my-account.controller.ts`
- `apps/api/src/controllers/users/my-account.http.spec.ts`
- `apps/api/src/entities/users/users.entity.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/services/users/my-account.service.ts`
- `apps/api/src/services/users/users.service.ts`
- `apps/api/src/services/users/avatar.util.ts`
- `apps/api/src/services/storage/storage.service.ts` y `.spec.ts`
- `apps/api/src/services/auth/auth.service.ts` y `.spec.ts`
- Pruebas HTTP de auth, registro y reset: solo adaptación de inyección del servicio
  Storage, sin cambios en los flujos de negocio de registro o recuperación.

Frontend:

- `apps/web/src/components/AccountAvatar.tsx`
- `apps/web/src/components/auth/AuthGuard.tsx`
- `apps/web/src/components/auth/AuthGuard.profile.test.tsx`
- `apps/web/src/components/layout/shared/UserDropdown.tsx` y `.test.tsx`
- `apps/web/src/types/auth.ts` y `users.ts`
- `apps/web/src/services/users/myAccountService.ts` y `.test.ts`
- `apps/web/src/views/account-settings/account/AccountDetails.tsx`
- `apps/web/src/views/account-settings/account/AccountPhoto.tsx` y `.test.tsx`
- `apps/web/src/views/account-settings/account/Account.test.tsx`: adaptación al
  contexto y al componente de foto separado.

Documentación: este archivo, contrato Storage de #82 y referencia desde el informe
original de HU-USR-08. Otros cambios visibles en git status pertenecen a la entrega
previa de esta conversación, conservada sin commit.

## Pruebas y verificación

Se agregan 13 pruebas HTTP de avatar y cuatro de Storage: subida, autenticación,
MIME/firma/tamaño, archivo único, propiedad, persistencia, orden de reemplazo,
compensación ante fallos de BD, conflicto concurrente, eliminación, limpieza
pendiente y conservación tras desactivar. Se mockea el provider: no se llama a Neon.

Se agregan 19 pruebas frontend: diez de AccountPhoto, cuatro de UserDropdown, tres
de estado global y dos del servicio multipart/eliminación. Cubren selección,
subida, estados, validaciones, éxito/error, confirmación/cancelación, fallback,
actualización global, navegación y logout.

La suite completa pasa con 455 pruebas backend en 45 suites y 246 frontend en
37 archivos. Lint y format pasan en ambas aplicaciones. El build completo pasa;
conserva el aviso preexistente de baseline-browser-mapping. No se ejecuta CI remota
ni se realiza commit, push, PR o merge. Las pruebas usan persistencia simulada;
la concurrencia no se ha medido contra PostgreSQL real.

Revisión visual de los fuentes actuales en una copia temporal aislada, con API
ficticia e imagen PNG sintética: escritorio 1440×900, tablet 768×1024 y móvil
390×844. Se verificaron navegación desde el menú con ArrowDown/Enter, cierre con
Escape, subida, foto cargada en los tres avatares, eliminación confirmada,
cancelación, retorno a iniciales y modo oscuro. No hubo desborde horizontal; tras
eliminar, el foco vuelve a Cambiar foto. Los servidores locales preexistentes se
conservaron. No se llamó a Neon ni se modificaron cuentas reales en esta revisión.

`git diff --check` y la comprobación de formato de los documentos pasan. No hay
decisiones funcionales pendientes; se mantiene la limitación de limpieza manual
ante errores externos y las características públicas del bucket ya definidas en #82.
