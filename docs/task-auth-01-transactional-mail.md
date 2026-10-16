# TASK-AUTH-01: Correo transaccional con Gmail SMTP + App Password

## Arquitectura y configuración

Los servicios de negocio siguen dependiendo de `MailService.send()`, que valida entradas y renderiza las plantillas existentes. `MailModule` enlaza `MailTransport` con `GmailSmtpMailProvider` (en `gmail-mail.provider.ts`). Solo este provider utiliza Nodemailer, ya instalado con tipos incluidos. No se modifican autenticación, recuperación de contraseña ni frontend. Resend ya no tiene implementación ni dependencias en este repositorio.

Configurar en el entorno del backend o en `apps/api/.env`, ignorado por Git. Nunca usar `NEXT_PUBLIC_*` ni versionar secretos:

| Variable                  | Uso                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `MAIL_PROVIDER`           | `gmail-smtp`; otros valores son rechazados                                                                              |
| `MAIL_GMAIL_USER`         | Cuenta Gmail con verificación en dos pasos habilitada                                                                   |
| `MAIL_GMAIL_APP_PASSWORD` | App Password generada manualmente; se ignoran espacios de presentación de Google; nunca usar la contraseña de la cuenta |
| `MAIL_FROM_EMAIL`         | Debe coincidir con `MAIL_GMAIL_USER`; no se configuran aliases                                                          |
| `MAIL_FROM_NAME`          | Nombre visible; predeterminado `MEDISUR`                                                                                |
| `MAIL_TIMEOUT_MS`         | Entero entre 1000 y 30000 ms; predeterminado 10000                                                                      |
| `MAIL_TEST_TO`            | Destino de la prueba manual                                                                                             |

Se requiere una cuenta Gmail, 2-Step Verification y una App Password. Ver la [guía oficial de Nodemailer para Gmail](https://nodemailer.com/guides/using-gmail). Para producción institucional se puede migrar posteriormente a un proveedor transaccional con dominio autenticado, conservando `MailTransport`.

La validación existente en `mail.config.ts` se ejecuta al construir el provider: rechaza configuración incompleta, emails inválidos, remitentes diferentes y saltos de línea en el nombre. Los errores indican únicamente la variable inválida. Se conserva el comportamiento existente: una configuración inválida impide iniciar los módulos que importan `MailModule`. No se establece conexión de red ni se ejecuta `verify()` al arrancar o por cada correo.

## Transporte y errores

### Logo público de los correos

`MEDISUR_EMAIL_LOGO_URL` es una variable opcional del backend con la URL HTTPS
pública y estable del logo existente en el bucket Neon `public-read`. No se utiliza
una URL firmada ni se necesitan credenciales o un SDK S3 para mostrar la imagen.
No había configuración de storage ni helpers de URLs públicas en el repositorio;
se utiliza la URL completa para evitar duplicar endpoint, región y bucket.

Objeto confirmado: `logo.png`. URL pública verificada mediante GET anónimo (200,
`image/png`):

```text
https://br-dry-sunset-b4a4y2vv.storage.c-6.us-east-2.aws.neon.tech/public-read/logo.png
```

El endpoint proporcionado corresponde a `us-east-2`. Neon usa URLs path-style
`<endpoint>/<bucket>/<key>`; ver la [documentación de Object Storage](https://neon.com/docs/storage/get-started).
El listado anónimo del bucket devuelve 403, mientras que el objeto permite lectura
anónima. No se modifican políticas, buckets ni objetos y no se sube un nuevo logo.

`MailService` pasa la configuración a `renderMail`; el header incluye un `<img>`
con alt MEDISUR, ancho 180 y estilos inline compatibles con correo. El texto plano,
asunto y contenido restante se conservan. Sin URL o con una URL inválida, HTTP,
con credenciales, query o fragmento se muestra MEDISUR como texto. Se escapan los
atributos HTML. El fallback de configuración no descarga ni comprueba la imagen al
enviar; algunos clientes pueden bloquear imágenes externas y mostrar su texto alt.

La configuración local debe conservarse fuera de Git. En producción se debe
configurar la URL pública correspondiente al asset de esa instancia.

Se utiliza `smtp.gmail.com:465`, TLS y `auth: { user, pass }`. No se requiere Google Cloud, OAuth2, access token ni refresh token; las variables `MAIL_GOOGLE_CLIENT_ID`, `MAIL_GOOGLE_CLIENT_SECRET` y `MAIL_GOOGLE_REFRESH_TOKEN` se retiran del código y del ejemplo. Si persisten en un entorno privado, ya no se consultan y pueden retirarse de su configuración.

`MAIL_TIMEOUT_MS` configura los límites soportados de conexión, saludo, socket y DNS. Son límites de conexión/inactividad, no un plazo total exacto de entrega. Se conserva la validación de certificados; logging y debug de Nodemailer quedan desactivados.

El contrato sigue devolviendo `{ accepted: true }` o `{ accepted: false, reason }`. Se comprueba que SMTP aceptó al destinatario. Los errores devuelven `provider-error`; Nest Logger registra solamente un mensaje fijo, códigos/comandos de una lista permitida y un código de respuesta numérico válido. Nunca registra el error libre, la respuesta SMTP, credenciales o contenido. El transporte se cierra al destruir el módulo.

El segundo argumento de `send` conserva su firma y genera un Message-ID estable. SMTP no garantiza deduplicación por Message-ID. No se agregan reintentos automáticos; después de un timeout la aceptación puede ser incierta.

## Prueba manual

Con las variables locales configuradas:

```sh
pnpm --filter medisur-system-backend start
# En otra terminal:
pnpm --filter medisur-system-backend mail:test
```

`mail:test` reutiliza un contexto Nest con ConfigModule y MailModule, sin requerir PostgreSQL/Redis ni crear endpoints públicos. Envía a `MAIL_TEST_TO` mediante `MailService`, cierra el contexto y devuelve código uno ante configuración inválida o fallo. No imprime secretos.

El asunto es `Prueba de correo MEDISUR`; el contenido incluye `El servicio de correo transaccional de MEDISUR está configurado correctamente.`. Confirmar en la cuenta destino la recepción (incluido spam), el remitente `MEDISUR <MAIL_FROM_EMAIL>`, asunto y contenido. La aceptación SMTP confirma autenticación y aceptación del mensaje, pero no confirma su llegada a la bandeja.

Las pruebas unitarias mockean Nodemailer y no se conectan a Gmail. Cubren transporte, credencial sintética generada en memoria, remitente, timeouts, configuración inválida, aceptación/rechazo, errores sanitizados y cierre. Se conservan las pruebas de MailService, plantillas y comando interno.

## Verificación local — 15 de octubre de 2026

El backend arrancó correctamente con las variables locales. El comando mail:test terminó con código cero y Gmail aceptó el correo usando App Password. El usuario confirmó la recepción del correo de prueba con remitente y contenido correctos. La aceptación SMTP y la recepción en la cuenta destino quedaron verificadas.
