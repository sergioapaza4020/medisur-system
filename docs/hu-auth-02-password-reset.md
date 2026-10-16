# HU-AUTH-02: Restablecer contraseña

## Flujo y contrato

El enlace emitido por HU-AUTH-01 abre `/reset-password?token=...`. La nueva página utiliza Material UI/Materio y los componentes existentes. Valida el token antes de mostrar campos, solicita contraseña y confirmación, muestra los requisitos existentes y bloquea envíos simultáneos. Ante un fallo borra ambas contraseñas y requiere verificar otra vez el enlace. Tras completar, elimina la autenticación local mediante las utilidades existentes y redirige a `/login`; no inicia sesión automáticamente.

La página declara `referrer=no-referrer` y excluye indexación. No guarda el token ni contraseñas en cookies o almacenamiento web. Los servicios usan exclusivamente el cliente Axios central y `getApiErrorMessage`.

| Método | Endpoint                            | Cuerpo                                 | Resultado normal                          |
| ------ | ----------------------------------- | -------------------------------------- | ----------------------------------------- |
| POST   | `/api/auth/reset-password/validate` | `token`                                | `200`, enlace válido; no consume el token |
| POST   | `/api/auth/reset-password`          | `token`, `password`, `confirmPassword` | `200`, contraseña restablecida            |

Ambos endpoints son públicos porque se autoriza mediante el token de recuperación. Los datos sensibles viajan en el cuerpo JSON, nunca en parámetros de la URL de la API. Las respuestas conservan el envelope del proyecto y no devuelven datos de usuario, contraseña, hash o token. Un enlace inválido, expirado, utilizado o asociado a una cuenta inactiva produce `400` con un mensaje genérico. Los cuerpos incompletos o contraseñas inválidas también se rechazan con `400`.

El limitador compartido de HU-AUTH-01 admite 30 operaciones de validación/restablecimiento por IP cada 15 minutos, bajo un ámbito independiente de las solicitudes de correo. Se devuelve `429` cuando se supera; un fallo del limitador impide continuar y produce `503` genérico. La IP se obtiene con el patrón existente, sin interpretar directamente cabeceras de proxy.

## Seguridad e integridad

`RecoveryTokenDto` exige el formato de los tokens existentes: 64 caracteres hexadecimales en minúscula. Se consulta su hash SHA-256, la expiración y el estado de la cuenta. La validación inicial solo habilita el formulario; el guardado siempre comprueba nuevamente el token.

`ResetPasswordDto` reutiliza las reglas de contraseña de `RegisterPatientDto`: al menos 8 caracteres, mayúscula, minúscula, número y máximo 72 bytes. La confirmación es obligatoria y se compara en backend. El frontend reutiliza `getRegistrationPasswordFeedback`, sin crear una segunda política.

Se reutiliza `hashPassword()` y bcrypt con coste 10. El hash se calcula antes de adquirir bloqueos para reducir su duración. Una única transacción TypeORM:

1. Bloquea la cuenta activa con `pessimistic_write`, serializando restablecimientos incluso con enlaces distintos.
2. Bloquea y vuelve a comprobar el token y su expiración después de esperar el bloqueo.
3. Actualiza exclusivamente la contraseña y el responsable de actualización de esa cuenta.
4. Revoca las sesiones activas mediante `SessionsService.revokeForPasswordChange()`, usando el mismo manager transaccional.
5. Elimina todos los tokens de recuperación existentes de esa cuenta.

El resultado es de un solo uso y los enlaces anteriores tampoco sobreviven al cambio. Un fallo en cualquier escritura provoca rollback de todo el conjunto. Los tokens son credenciales efímeras; su eliminación no elimina usuarios ni historial médico.

Las sesiones conservan `revokedAt`, `revokedBy` y el motivo existente `PASSWORD_CHANGED`. Los access tokens anteriores dejan de autorizar recursos porque la estrategia JWT comprueba la sesión; los refresh tokens también se rechazan. El usuario queda con `updatedBy` y `updatedAt` según la infraestructura existente. No se incorpora un sistema de auditoría completo: la emisión de un evento de auditoría podrá integrarse cuando exista ese módulo, sin incluir contraseñas o tokens.

## Datos y despliegue

No se agregan entidades, migraciones, variables de entorno, dependencias ni permisos. Se reutilizan la tabla de tokens de HU-AUTH-01, User y UserSession. La migración de recuperación existente debe estar aplicada. El motivo de revocación ya existe en el enum y en la migración inicial.

La entrega de enlaces sigue utilizando el correo configurado en TASK-AUTH-01. Deben excluirse los parámetros sensibles de los registros de acceso del proxy/hosting al desplegar páginas de recuperación. El nuevo código no registra tokens ni contraseñas.

## Archivos modificados

- `apps/api/src/dtos/auth/reset-password.dto.ts`: DTO de token y contraseña con política reutilizada.
- `apps/api/src/services/auth/password-reset.service.ts`: validación, limitación y transacción de restablecimiento.
- `apps/api/src/controllers/auth/password-reset.controller.ts`: endpoints públicos.
- `apps/api/src/controllers/auth/password-reset.http.spec.ts`: pruebas HTTP del flujo, sesiones y fallos transaccionales.
- `apps/api/src/services/sessions/sessions.service.ts`: revocación por cambio de contraseña dentro del manager recibido.
- `apps/api/src/modules/auth/auth.module.ts`: registro local del servicio y controlador.
- `apps/web/src/app/(blank-layout-pages)/reset-password/page.tsx`: ruta y metadata de privacidad.
- `apps/web/src/views/pages/auth/ResetPassword.tsx`: formulario y verificación del enlace.
- `apps/web/src/views/pages/auth/ResetPassword.submit.test.tsx`: pruebas del formulario.
- `apps/web/src/services/auth/authService.ts`: integración con Axios y limpieza de autenticación al completar.
- `apps/web/src/services/auth/authService.test.ts`: contrato HTTP y estado local.
- `docs/hu-auth-01-password-recovery-request.md`: referencia al flujo de consumo implementado.
- `docs/hu-auth-02-password-reset.md`: contrato, seguridad y verificación.

## Pruebas y límites de verificación

Las pruebas HTTP utilizan Nest, sus guards, validación, AuthService, SessionsService y PasswordResetService reales, con repositorios y transacciones simulados. Incluyen token válido, inexistente, malformado, expirado durante el bloqueo y reutilizado; cuenta inactiva; confirmación; contraseña débil y límite multibyte; hash y login con la nueva clave; rechazo de la anterior; revocación de access/refresh; solicitudes simultáneas del mismo token y de tokens distintos; rollback en cada etapa y limitación de solicitudes.

Las pruebas frontend comprueban carga, bloqueo de formularios sin validación, enlaces inválidos, reutilización de política, confirmación, doble envío, limpieza de contraseñas, errores, redirección y uso del cliente HTTP común. No se ejecutaron pruebas contra PostgreSQL real ni CI remota. No se envió correo real durante esta HU; se conservó la integración de la dependencia.

Pasaron `pnpm test` (344 pruebas backend en 40 suites y 209 frontend en 32 archivos), `pnpm lint`, `pnpm format`, `pnpm build`, el formato de la documentación y `git diff --check`. Hay 37 pruebas nuevas: 22 backend y 15 frontend. Tras los ajustes finales del formulario se repitieron sus pruebas y las del servicio de autenticación: 27 pruebas exitosas. El build incluye comprobación TypeScript y la nueva ruta `/reset-password`. Persiste la advertencia previa de antigüedad de datos de `baseline-browser-mapping`, sin impedir el build ni requerir cambios de dependencias para esta HU.
