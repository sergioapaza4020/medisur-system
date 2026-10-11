# HU-USR-02 — Registro de pacientes

## Flujo

La página pública `/register`, accesible desde el login, permite crear una cuenta inicial con nombres, apellidos, correo electrónico, documento de identidad y contraseña. Reutiliza el diseño Materio/MUI, el servicio de autenticación y el cliente Axios existentes. Valida los campos, muestra mensajes de API en español, impide doble envío y confirma el registro antes de redirigir automáticamente con `router.replace('/login')`, sin temporizadores. No inicia una sesión automáticamente. La contraseña se limpia después del éxito o de un error de API.

Tras el registro exitoso se guarda únicamente `{ success: true, email }`
en `sessionStorage`, bajo `medisur.registration`. El identificador es el correo normalizado; el login autentica únicamente por correo. Al montar
el login se consume y elimina este dato temporal, se rellena Correo electrónico y se muestra
`Cuenta creada correctamente. Inicia sesión para continuar.` mediante un Alert de éxito.
Contraseña permanece vacía: nunca se transfiere en el almacenamiento ni en la URL.
El dato es solo feedback, no una fuente de autenticación. Los accesos posteriores
sin aviso conservan el login vacío y sin mensaje de registro. Si el navegador bloquea
el almacenamiento, la navegación continúa normalmente sin prefill ni aviso.
Un registro fallido conserva los errores existentes y no guarda aviso ni redirige.

Se utiliza la entidad `User` y la relación existente con roles. No se requiere una entidad o perfil adicional para los datos de la cuenta inicial; los datos clínicos quedan fuera de esta historia. Se retiraron los controles decorativos de registro con Google/Facebook y el checkbox de términos que apuntaba a un enlace sin documento.

## API

`POST /api/auth/register` es público y recibe exclusivamente los seis campos de la cuenta. El DTO deriva de `UserCreateDto` omitiendo `roleNames`. La validación global elimina campos adicionales y el servicio construye explícitamente los datos permitidos, por lo que roles, permisos, identificadores, estado y autores enviados por el cliente no se persisten.

```json
{
  "name": "Ana María",
  "lastname": "Pérez",
  "email": "ana@example.com",
  "ci": "1234567-1A",
  "password": "Ejemplo123"
}
```

Devuelve 201 con el envelope común, mensaje de éxito y `data: { idUser, email }`. No devuelve contraseñas, hashes ni tokens. El registro delega en `UsersService.create`, conservando bcrypt con factor 10 y el guardado de usuario/roles existente. El backend asigna exclusivamente `PATIENT` y el estado activo predeterminado del modelo. `createdBy` queda sin autor administrativo en el registro público; la columna existente admite null. Las capacidades efectivas siguen dependiendo de los permisos configurados para el rol, sin privilegios administrativos implícitos.

El rol `PATIENT` debe existir y estar activo, conforme al seed de acceso existente. Si no está disponible, el registro devuelve 503 en español y no crea la cuenta. No hay fallback a otro rol.

## Validaciones

- Se eliminan espacios exteriores de nombres, apellidos, usuario, correo y documento. La contraseña se conserva íntegra.
- Nombres/apellidos: letras Unicode, espacios, apóstrofes y guiones, hasta 100 caracteres.
- Usuario: de 3 a 50 caracteres; letras ASCII, números, punto, guion y guion bajo.
- Correo: formato válido, hasta 254 caracteres.
- Documento: de 3 a 30 caracteres alfanuméricos, espacios, puntos o guiones; debe comenzar con un carácter alfanumérico.
- Contraseña de registro: mínimo 8 caracteres, una mayúscula, una minúscula y un número; máximo 72 bytes UTF-8 para evitar truncamiento en bcrypt. No había una política de complejidad existente; se define para este flujo sin cambiar las credenciales existentes ni el login.

El registro muestra requisitos en tiempo real con iconos y texto Cumplido/Pendiente,
sin exigir símbolos. La misma función frontend determina indicadores y validación.
La fortaleza es orientativa: menos de tres requisitos de composición/longitud cumplidos
es Débil; tres o una contraseña válida de menos de 12 caracteres es Media; todos los
requisitos y al menos 12 caracteres es Fuerte. Superar el límite siempre es inválido y
se muestra Débil. La fortaleza no sustituye la validación ni estima resistencia real.

El máximo existente es técnico, no una política funcional de número fijo de caracteres:
con acentos o emojis caben menos caracteres. No se convierte arbitrariamente en un
máximo de 64 o 72 caracteres. La interfaz indica Longitud máxima permitida y explica
esa variación sin exponer bytes, bcrypt ni detalles de hashing; el error de longitud
es `La contraseña es demasiado larga. Usa menos caracteres.` en frontend y backend.
No cambian el algoritmo, el límite ni las reglas del DTO. Definir un máximo funcional
fijo queda pendiente de una decisión de negocio. No existe confirmación de contraseña.

Se mantienen los identificadores únicos del modelo (`email`, `ci`); el correo se normaliza con `trim().toLowerCase()` en creación, registro, edición y búsqueda. La comprobación previa incluye cuentas inactivas. Las restricciones PostgreSQL siguen siendo la garantía final: una colisión durante el guardado (23505) se convierte en un error controlado, sin detalles SQL. El registro muestra un mensaje genérico de duplicado en español sin identificar cuál campo coincidió. No se modifican las reglas administrativas de autorización.

## Archivos modificados o añadidos

```text
apps/api/src/controllers/auth/auth.controller.ts
apps/api/src/controllers/auth/register.http.spec.ts
apps/api/src/dtos/auth/register-patient.dto.ts
apps/api/src/services/auth/auth.service.ts
apps/api/src/services/users/users.service.ts
apps/web/src/services/auth/authService.ts
apps/web/src/services/auth/authService.test.ts
apps/web/src/types/auth.ts
apps/web/src/utils/patientRegistration.ts
apps/web/src/utils/patientRegistration.test.ts
apps/web/src/views/pages/auth/Register.tsx
apps/web/src/views/pages/auth/Register.submit.test.tsx
docs/hu-usr-02-patient-registration.md
```

## Verificación

Se añadieron pruebas de registro seguido de login y usuario actual, hash bcrypt real, permisos efectivos, 403 administrativo, duplicados en los tres identificadores y cuentas inactivas, colisión de unicidad al guardar, validaciones de campos y contraseña, límite UTF-8, rol PATIENT no disponible y payloads de escalamiento de privilegios. En frontend se cubren validaciones, uso del Axios central, campos enviados, carga, doble envío, éxito, limpieza de contraseña y recuperación tras error de API.

Checks locales: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build`, `pnpm --filter medisur-system-frontend exec tsc --noEmit` y `git diff --check`. Pruebas: 147 backend en 25 suites y 81 frontend en 14 archivos, exitosas.

Las pruebas HTTP utilizan Nest, servicios y guards reales con repositorios simulados. Queda por ejecutar la validación contra PostgreSQL real y la CI remota al publicar la rama. El build conserva el aviso preexistente de datos antiguos de `baseline-browser-mapping`, sin afectar el resultado.
