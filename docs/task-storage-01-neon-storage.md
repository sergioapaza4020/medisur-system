# TASK-STORAGE-01 — Imágenes públicas en Neon Storage (#82)

## Revisión e integración elegida

El backend usa NestJS, TypeORM/PostgreSQL con `DATABASE_URL`, ConfigModule global y ConfigService. La conexión local se identificó como Neon sin imprimir sus valores. No existían cliente de object storage ni endpoints de archivos; Multer está instalado, pero no hay flujo activo de subida. Los módulos siguen la separación `modules` / `services` / `common`, con validación por proveedor, excepciones Nest y Logger. La URL pública del logo de correo ya existía y no se modifica.

Neon documenta el [SDK AWS S3 compatible](https://neon.com/docs/storage/s3-compatibility) para sus operaciones básicas, con `forcePathStyle: true`. Se agrega únicamente `@aws-sdk/client-s3` en `apps/api` y su lockfile; no se usa un cliente HTTP manual para escribir o eliminar objetos. Las lecturas anónimas del script son verificaciones del recurso público.

La [autenticación de Storage](https://neon.com/docs/storage/authentication) es independiente de PostgreSQL: `token_id` corresponde a Access Key ID y `s3_secret_access_key` a Secret Access Key. Se requiere una credencial con `storage:write`. El endpoint y región se obtienen de Neon para la rama seleccionada. No se necesita cuenta AWS/IAM ni una clave administrativa Neon en runtime.

Los [buckets](https://neon.com/docs/storage/buckets) son propios de la rama. `public-read` es el nombre previsto; **el nombre no otorga acceso público**: su nivel debe ser `public_read` en Neon. La integración no crea buckets, no cambia políticas y no envía ACL S3. Neon no soporta las operaciones de modificación de ACL/políticas por S3.

## Arquitectura y contrato

```text
Servicio de negocio → StorageService → StorageProvider → NeonStorageProvider → S3Client → Neon
```

`StorageModule` exporta solamente `StorageService`; el SDK, configuración y provider quedan internos e inyectables para tests. Los futuros módulos deben importar StorageModule. No se importa globalmente ni se conecta a User/Doctor. La configuración se valida al importar el módulo; construir el cliente no realiza llamadas de red. No existe controlador ni endpoint genérico de subida.

- `uploadImage({ buffer, mimeType, context? })` devuelve `{ key, url }` después de confirmar la subida.
- `getPublicUrl(key)` obtiene la referencia pública de una key administrada; no comprueba existencia.
- `delete(key)` elimina una key administrada; repetir una eliminación es idempotente. Errores de bucket/permisos se propagan como errores controlados.
- `replace(previousKey, input, persist?)` devuelve `{ key, url, cleanupPending, previousKey? }`.
  La integración posterior de avatar admite `previousKey=null` para la primera
  imagen y un callback opcional de persistencia. Sube primero, espera a que ese
  callback confirme la escritura en BD y solo entonces elimina la imagen anterior.
  Si falla la persistencia, intenta eliminar la imagen nueva y conserva la anterior.
- `getImagePolicy()` expone solamente `{ maxSize, mimeTypes }`, para aplicar la misma
  política en el receptor multipart y mostrarla en frontend sin revelar configuración privada.

Las keys tienen el formato `images/<uuid-v4>.<ext>` o `images/<contexto>/<uuid-v4>.<ext>`. El contexto es opcional, un único segmento de 1–40 caracteres: empieza con letra minúscula y admite letras, números y guion. Debe elegirlo el backend. No se acepta una ruta original, URL, traversal, segmentos anidados, porcentajes o nombres de persona. Delete y getPublicUrl solo admiten este namespace y formato; por ejemplo, no pueden borrar `logo.png`.

## Variables del backend

Configurar en el entorno privado o `apps/api/.env`, nunca en frontend. El archivo local no se modifica ni se imprimen sus valores.

| Variable                 | Uso                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`       | Obligatorio: `neon`                                                                    |
| `STORAGE_BUCKET`         | Obligatorio: bucket existente, previsto `public-read`                                  |
| `STORAGE_MAX_IMAGE_SIZE` | Bytes; predeterminado 5242880 (5 MiB); entero de 1 a 52428800 (50 MiB)                 |
| `AWS_ENDPOINT_URL_S3`    | Endpoint HTTPS de Storage de la rama, sin bucket, credenciales URL, query ni fragmento |
| `AWS_REGION`             | Región de ese endpoint                                                                 |
| `AWS_ACCESS_KEY_ID`      | `token_id` de la credencial de Storage                                                 |
| `AWS_SECRET_ACCESS_KEY`  | Secreto S3 de esa credencial                                                           |

Se rechazan proveedores diferentes, variables requeridas vacías, buckets inválidos, endpoints ajenos al servicio Neon, regiones inconsistentes y tamaños inválidos. Los errores nombran únicamente la variable. Las credenciales son explícitas; no se usa el fallback a credenciales del host. El SDK tiene dos intentos máximos y límites de conexión/solicitud, sin nuevas variables innecesarias.

## Validación y URL

Solo se admiten JPEG (`image/jpeg` → `.jpg`), PNG (`image/png` → `.png`) y WebP (`image/webp` → `.webp`). No se consulta `originalname`. Se valida Buffer obligatorio, tamaño real, MIME y firma básica del contenido; se copia el buffer validado antes de enviarlo. SVG, GIF, PDF y tipos genéricos se rechazan.

La inspección de firma **no decodifica ni sanea completamente la imagen**: no elimina EXIF, no prueba todos los CRC ni detecta todos los archivos corruptos, políglotas o bombas de descompresión. No se añadió un decodificador pesado. Si las HU posteriores requieren transformación, límites de dimensiones o eliminación de metadata, deben incorporarlos antes de publicar la imagen.

AWS S3 SDK no ofrece un helper de URL pública. El provider aplica exclusivamente el formato path-style [documentado por Neon](https://neon.com/docs/storage/buckets), a partir del endpoint configurado, bucket y segmentos codificados. La URL es HTTPS, pública y sin firma; no expira por tiempo, pero deja de servir si se elimina el objeto o cambia su acceso. Otra rama, bucket o endpoint produce otra URL. Se recomienda persistir la **key** y conservar la identidad del bucket/entorno si se usan varios; derivar la URL con el servicio en vez de guardar URLs firmadas.

## Reemplazo, errores y limpieza

Primero se validan referencia anterior e imagen nueva; después se sube la nueva y finalmente se elimina la anterior. Si la subida falla, no se toca la anterior y se intenta eliminar únicamente la nueva UUID para compensar una aceptación incierta por timeout. Si esa compensación falla, se conserva el error original y se registra la key para revisión.

Si falla la eliminación anterior tras subir, se conserva y devuelve la referencia nueva con `cleanupPending: true` y `previousKey`. El llamante debe persistir el nuevo resultado y tratar esa limpieza pendiente; no debe repetir ciegamente toda la operación. No hay jobs ni garbage collection. Fallos de red pueden dejar resultados inciertos y no existe transacción distribuida entre PostgreSQL y Storage.

Archivos inválidos usan BadRequestException; tamaño excedido, PayloadTooLargeException; fallos externos, ServiceUnavailableException con mensajes fijos en español. Los logs contienen operación, provider, key sin datos personales y, cuando corresponde, un código de error de una lista permitida. No se registran buffers, credenciales, respuestas libres ni stacks del SDK.

Neon realiza [eliminación lógica en la rama actual](https://neon.com/docs/storage/s3-compatibility); no se promete purga física ni eliminación de snapshots de otras ramas. Los objetos usan caché pública de 300 segundos: una copia ya cacheada por un navegador/CDN puede sobrevivir a la eliminación en origen. Este bucket es para imágenes deliberadamente públicas, nunca contenido clínico confidencial.

## Prueba real

Con las variables configuradas:

```sh
pnpm --filter medisur-system-backend storage:test
```

El comando abre solo ConfigModule y StorageModule, sin PostgreSQL/Redis, genera un PNG RGB no sensible de 64×64 y opera únicamente bajo `images/storage-test/<uuid>.png`. Comprueba subida, GET público sin credenciales, MIME y bytes idénticos; guarda una copia temporal local para inspección visual; reemplaza, comprueba que la URL anterior no esté disponible, elimina dos veces y comprueba que la nueva URL tampoco esté disponible. Intenta limpiar sus propias keys incluso ante error. No lista ni modifica objetos ajenos. Una respuesta de lectura ausente debe ser 403, 404 o 410; otros errores no se consideran prueba de eliminación.

**Resultado real:** exitoso contra el bucket `public-read` con las credenciales locales proporcionadas. Se confirmaron conexión/escritura, lectura pública, igualdad de bytes, reemplazo, eliminación idempotente e indisponibilidad posterior. Se inspeccionó la copia descargada: cuadros azules y verdes correctos. El primer intento no completó la prueba; el siguiente completó todas las comprobaciones. No se atribuye una causa al primer fallo sin evidencia.

La configuración local detectada contenía las cuatro variables AWS, pero no `STORAGE_PROVIDER` ni `STORAGE_BUCKET`. Para esta ejecución se establecieron `neon` y `public-read` solo en el proceso y se restauraron después. Deben configurarse permanentemente en el entorno privado antes de importar StorageModule en módulos de negocio. `.env` no fue editado. No se modificaron el logo ni objetos preexistentes.

## Archivos y pruebas

- `apps/api/src/modules/storage/storage.module.ts`: DI y exportación del servicio.
- `apps/api/src/services/storage/storage.config.ts` y `.spec.ts`: validación de configuración.
- `apps/api/src/services/storage/storage.provider.ts`: contrato independiente del SDK.
- `apps/api/src/services/storage/neon-storage.provider.ts` y `.spec.ts`: adaptador y errores sanitizados.
- `apps/api/src/services/storage/storage.service.ts` y `.spec.ts`: validación, keys, subida, borrado y reemplazo.
- `apps/api/src/common/test-mocks/storage-image.mock.ts`: PNG no sensible reutilizable para pruebas.
- `apps/api/src/storage-test.ts` y `.spec.ts`: prueba interna, lectura y limpieza controlada.
- `apps/api/package.json`, `pnpm-lock.yaml`: SDK y comando.
- `apps/api/.env.example`: variables sin secretos.
- `docs/task-storage-01-neon-storage.md`: contrato y configuración.

Las pruebas unitarias mockean el provider/SDK y fetch: cubren resultados key/url, MIME, tamaños, contenido falsificado, contextos/keys inseguros, ausencia de ACL, errores de borrado, idempotencia, reemplazo, fallos de subida y limpieza, configuración y cierre del cliente. Las pruebas del script tampoco llaman al proveedor real.

Verificación final: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build` y `git diff --check` exitosos. Se ejecutaron 413 pruebas backend en 44 suites y 209 frontend en 32 archivos; 59 pruebas nuevas corresponden a Storage. Tras los ajustes finales también se repitieron las 59 pruebas específicas y la suite backend completa. Se verificaron el formato de esta documentación y de package.json. Turborepo reutilizó los checks previos del frontend sin modificaciones. La prueba real se ejecutó separadamente de Jest. No se ejecutó CI remota ni se realizó commit, push, PR o merge.

## Integración posterior

Cada HU de foto de perfil/médico deberá autorizar al propietario en backend, elegir el contexto desde código y aplicar el límite también en Multer antes de cargar el archivo en memoria. No se debe aceptar una key de borrado arbitraria del cliente. Persistir la nueva referencia solo tras subir correctamente; si falla la escritura en BD, eliminar la imagen nueva. Para mantener coherencia con BD, es preferible orquestar `uploadImage → guardar key → delete anterior` en el módulo de negocio antes que eliminar la anterior antes de confirmar la escritura. Tratar limpieza pendiente sin perder la referencia nueva y conservar fallback visual. Ninguna de estas pantallas o entidades fue modificada en esta task.
