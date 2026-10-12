# TASK-AUTH-01: Correo transaccional con Gmail OAuth2

## Arquitectura

Los servicios de negocio consumen `MailService`, que valida destinatarios/enlaces y renderiza las plantillas existentes. `MailTransport` sigue siendo el contrato desacoplado. `MailModule` conecta ese contrato con `GmailMailProvider`, el único componente que conoce Nodemailer. No cambian `MailService.send()`, autenticación, recuperación ni los templates.

## Configuración

Configurar exclusivamente en el entorno del backend o en `apps/api/.env`, nunca versionar secretos ni usar `NEXT_PUBLIC_*`:

| Variable                    | Uso                                                      |
| --------------------------- | -------------------------------------------------------- |
| `MAIL_PROVIDER`             | `gmail`; obligatorio, otros proveedores son rechazados   |
| `MAIL_GMAIL_USER`           | Dirección de la cuenta Gmail autorizada                  |
| `MAIL_GOOGLE_CLIENT_ID`     | Client ID OAuth de Google                                |
| `MAIL_GOOGLE_CLIENT_SECRET` | Client secret OAuth; secreto                             |
| `MAIL_GOOGLE_REFRESH_TOKEN` | Refresh token de la cuenta autorizada; secreto           |
| `MAIL_TIMEOUT_MS`           | Entre 1000 y 30000 ms; predeterminado 10000              |
| `MAIL_TEST_TO`              | Correo real válido para la utilidad de prueba            |
| `FRONTEND_URL`              | Origen existente permitido para enlaces de autenticación |

Al inicializar el provider se validan todas las variables obligatorias. Una configuración incompleta impide iniciar los módulos que importan MailModule, incluida autenticación. Los errores indican únicamente la variable inválida, nunca su valor. Las variables anteriores de API key y remitente independiente ya no se utilizan.

## OAuth2 y SMTP

Crear un cliente OAuth en Google Cloud, configurar la pantalla de consentimiento y autorizar la cuenta indicada en MAIL_GMAIL_USER con acceso offline para obtener un refresh token. El consentimiento debe incluir el scope SMTP `https://mail.google.com/`. Seguir la [guía oficial de Nodemailer para Gmail](https://nodemailer.com/usage/using-gmail/) y la [documentación OAuth2 de Gmail](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol). Guardar client secret y refresh token únicamente en la configuración privada del backend.

Se utiliza `smtp.gmail.com:465`, TLS y `auth.type = OAuth2`. Nodemailer obtiene y renueva automáticamente el access token con clientId, clientSecret y refreshToken; no se configura contraseña ni access token estático. Si el refresh token es revocado, expirado o carece del scope adecuado, el envío falla y es necesario volver a autorizar la cuenta. Ver [renovación integrada de Nodemailer](https://nodemailer.com/smtp/oauth2).

El remitente es siempre `MEDISUR <MAIL_GMAIL_USER>`. No hay configuración de un email From independiente. Los límites SMTP de conexión, saludo, socket y DNS, así como la petición de renovación OAuth, reciben MAIL_TIMEOUT_MS. Son límites por fase/inactividad, no una garantía de que el envío completo dure exactamente ese tiempo. TLS conserva validación de certificados; debug y logging internos de Nodemailer permanecen apagados.

## Contrato, errores e idempotencia

El resultado sigue siendo `{ accepted: true }` o `{ accepted: false, reason }`. El provider comprueba la aceptación del destinatario; no basta con que sendMail resuelva. Las plantillas reciben los mismos subject, html, text y to. MailService mantiene sus validaciones de enlaces, expiración e inputs.

Los fallos SMTP/OAuth/red devuelven `provider-error`. Nest Logger registra un mensaje fijo, códigos de error y comandos de una lista permitida, y responseCode numérico válido. Nunca registra el error libre, respuesta SMTP, credenciales, tokens, destinatarios ni contenido. La configuración devuelve errores seguros y explícitos al inicializar.

El segundo argumento de send conserva su firma y ahora produce un Message-ID estable. **SMTP no garantiza idempotencia ni deduplicación por Message-ID.** No se añaden reintentos automáticos ni almacenamiento de envíos. Tras un timeout puede existir aceptación incierta; reintentar puede duplicar el correo. Si una futura historia necesita entrega exactamente una vez deberá resolverlo con persistencia/outbox, dentro de su alcance.

## Prueba manual

Con todas las variables configuradas:

```sh
pnpm --filter medisur-system-backend mail:test
```

La utilidad carga ConfigModule y MailModule sin PostgreSQL/Redis, lee MAIL_TEST_TO y envía `{ kind: 'test', to }` mediante MailService. Muestra aceptación o motivo controlado, permite consultar los diagnósticos seguros y cierra siempre ApplicationContext. Devuelve código uno si la configuración o el envío falla. Nunca imprime credenciales.

Ejecutar dos veces y verificar ambos correos en la bandeja destino, remitente MEDISUR, asunto de prueba y ausencia de errores OAuth. Aceptación SMTP no garantiza entrega en la bandeja. No sustituir esta comprobación por mocks ni generar/envíar credenciales en chats.

## Archivos y pruebas

Se añade `nodemailer` al paquete backend mediante pnpm; la versión instalada incluye sus propios tipos TypeScript. El provider HTTP anterior y sus tests fueron sustituidos por `gmail-mail.provider.ts` y `gmail-mail.provider.spec.ts`. Se añade `mail.config.ts` y `mail-test.spec.ts`. Se actualizan MailModule, mail-test, .env.example y esta documentación. Los contratos, servicio y templates genéricos se conservan.

Las pruebas automatizadas mockean Nodemailer y no envían correos. Cubren OAuth2 y timeouts, configuración incompleta/inválida, remitente, aceptación/rechazo, dos envíos, cierre, logs sin secretos, delegación de MailService, templates y script mail:test. La entrega y renovación contra Gmail real requieren credenciales locales y permanecen pendientes hasta ejecutar la prueba manual.
