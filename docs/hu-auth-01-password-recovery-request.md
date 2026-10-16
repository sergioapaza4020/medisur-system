# HU-AUTH-01: Solicitud de recuperación de contraseña

## Contrato y alcance

`POST /api/auth/forgot-password` es público y recibe exclusivamente `{ "email": "usuario@correo.com" }`. Reutiliza las reglas de correo de `LoginDto`, su normalización, el pipe de validación y el envelope habitual de la API.

Para cualquier correo con formato válido, la respuesta normal es HTTP `200`:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.",
  "data": null
}
```

La respuesta es idéntica para una cuenta activa, inexistente, inactiva, limitada por dirección o cuyo envío falle. Los formatos inválidos reciben `400`. No se devuelven tokens, identificadores de usuario ni resultados del proveedor.

La pantalla existente `/forgot-password`, accesible desde el login, utiliza el cliente Axios centralizado mediante `authService.requestPasswordRecovery()`. Valida el correo, bloquea envíos simultáneos, deshabilita campos mientras solicita, muestra confirmación genérica y utiliza `getApiErrorMessage` para errores, incluidos `429` y problemas de conectividad. Se conserva su diseño Materio/MUI.

## Token y correo

Para cuentas activas, se generan 32 bytes criptográficamente aleatorios y se codifican en hexadecimal. Solo se almacena el hash SHA-256 del token, asociado al usuario y a una expiración de 15 minutos. El token completo se transmite únicamente al servicio central de correo, dentro del enlace `${FRONTEND_URL}/reset-password?token=...`. El origen proviene de configuración backend; no se acepta un destino proporcionado por el solicitante.

Se reutilizan `MailService`, su plantilla `password-reset` y el adaptador Gmail SMTP actual. No se registran destinatarios ni tokens en los nuevos logs. Si el token no puede persistirse, no se envía. Ante un resultado de envío rechazado o una excepción, se elimina ese registro; si esa limpieza también falla, el registro sigue sujeto a su expiración. Los enlaces previos no se invalidan al solicitar otro, para evitar que un tercero invalide enlaces legítimos.

Esta HU no modifica contraseñas ni sesiones. La pantalla `/reset-password`, la comprobación de expiración al consumir el token, su uso único, el cambio de contraseña y la política de invalidación de sesiones pertenecen a **HU-AUTH-02**. El enlace emitido establece el contrato para esa implementación; todavía no completa la recuperación de extremo a extremo.

## Protección frente a abuso y enumeración

Los contadores se almacenan en PostgreSQL, compartidos entre instancias del backend:

- Hasta 10 solicitudes por IP en una ventana de 15 minutos. Las adicionales reciben `429` con un mensaje genérico.
- Hasta 3 solicitudes por dirección normalizada en 15 minutos, aunque procedan de IP distintas. Las adicionales mantienen `200` y no generan correo.
- Los límites se aplican también a correos inexistentes e inactivos, antes de consultar usuarios.
- Se utilizan hashes de los ámbitos IP/correo, parámetros SQL y un `UPSERT` atómico. No se requiere Redis ni un limitador por proceso.
- Si falla el almacenamiento del limitador, se responde `503` genérico y no se intenta enviar.

La IP procede de Express; no se interpreta directamente `X-Forwarded-For`. No se cambió la configuración global de proxies. En despliegues con proxy, la política de confianza de Express debe revisarse explícitamente según la infraestructura; con el comportamiento actual, varios clientes detrás del mismo proxy pueden compartir límite.

La consulta de cuenta y el envío se procesan fuera de la espera HTTP para no revelar existencia por la latencia SMTP. El proceso admite como máximo 20 tareas pendientes; la saturación produce `429` independientemente del correo. El cierre mediante el contexto Nest espera las tareas pendientes.

Las tareas de envío **no constituyen una cola durable**: un cierre abrupto del proceso puede interrumpirlas. No se agregan reintentos automáticos ni infraestructura de colas. El usuario puede solicitar de nuevo dentro de los límites; los registros no utilizados caducan. Una garantía de entrega ante reinicios requeriría una tarea posterior de cola durable. Las filas de contadores caducadas se limpian al consumir límites; los tokens caducados se limpian al generar un nuevo token para una cuenta activa.

## Base de datos y despliegue

Aplicar la migración antes de utilizar el endpoint:

```sh
pnpm --filter medisur-system-backend migration:run
```

`PasswordRecovery1792080000000` crea `password_recovery_tokens` y `password_recovery_rate_limits`, con índices para hash único, usuario y expiraciones. Los UUID se generan en Node, sin nuevas extensiones PostgreSQL. No se alteran entidades de usuario, roles, permisos ni datos existentes. La migración inversa elimina únicamente estas dos tablas.

No se introducen variables de entorno: se reutiliza `FRONTEND_URL` y la configuración backend de Gmail definida en TASK-AUTH-01. En producción, el frontend debe usar HTTPS, conforme a las validaciones del servicio de correo. Debe verificarse la entrega con las credenciales del entorno.

## Archivos modificados

- `apps/api/src/modules/auth/auth.module.ts`: registro local de controlador, servicios y repositorios.
- `apps/api/src/controllers/auth/password-recovery.controller.ts`: endpoint público y respuesta genérica.
- `apps/api/src/controllers/auth/password-recovery.http.spec.ts`: pruebas HTTP con guards, validación y servicios reales, usando repositorios y correo simulados.
- `apps/api/src/dtos/auth/password-recovery.dto.ts`: reutilización de las validaciones del correo.
- `apps/api/src/entities/auth/password-recovery.entity.ts`: tokens y contadores.
- `apps/api/src/database/migrations/1792080000000-PasswordRecovery.ts`: tablas e índices.
- `apps/api/src/services/auth/password-recovery.service.ts`: solicitud, token, envío y manejo de fallos.
- `apps/api/src/services/auth/password-recovery-rate-limiter.ts`: límites compartidos y atómicos.
- `apps/api/src/services/auth/password-recovery-rate-limiter.spec.ts`: ámbito anonimizado y contrato SQL.
- `apps/web/src/services/auth/authService.ts`: petición mediante Axios existente.
- `apps/web/src/services/auth/authService.test.ts`: contrato HTTP sin crear sesión.
- `apps/web/src/views/ForgotPassword.tsx`: integración del formulario existente.
- `apps/web/src/views/ForgotPassword.submit.test.tsx`: validación, feedback, errores y doble envío.
- `docs/hu-auth-01-password-recovery-request.md`: contrato, despliegue y límites.

## Verificación

La suite completa pasó con 322 pruebas backend en 39 suites y 194 frontend en 31 archivos. Las pruebas nuevas cubren formato, normalización, hash, aleatoriedad, expiración, respuesta genérica, SMTP lento/fallido, persistencia fallida, límites de IP y correo, cabeceras falsificadas, saturación, bloqueo de doble envío y uso del cliente HTTP común.

Los repositorios y el correo se simulan en las pruebas. No se aplicó la migración a la base del usuario ni se enviaron correos reales. La ejecución de CI remota queda pendiente de publicación de los cambios.

Pasaron `pnpm lint`, `pnpm format`, `pnpm build`, la comprobación de formato de esta documentación y `git diff --check`. Después de los ajustes finales se repitieron las 18 pruebas backend del flujo y las 18 pruebas de los dos archivos frontend relacionados, todas exitosas. El primer build encontró tipos obsoletos de una página antigua en `.next/dev`; se eliminó exclusivamente esa caché generada, tras comprobar que no había un proceso Next activo, y el build completo pasó sin modificar configuración ni rutas ajenas a la HU.
