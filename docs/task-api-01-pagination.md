# TASK-API-01 — Paginación reutilizable

## Contrato y comportamiento

Los listados paginados usan páginas desde 1 y devuelven `data` y `meta`. Se mantiene el envelope del interceptor existente:

```json
{
  "status": true,
  "statusCode": 200,
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 57, "totalPages": 6 }
}
```

`PaginationQueryDto` define `page` (entero, mínimo 1, predeterminado 1) y `limit` (entero entre 1 y 100, predeterminado 10). El pipe de validación existente transforma los parámetros de la URL y rechaza valores inválidos. `total` corresponde a los registros que cumplen los filtros antes de limitar la página; `totalPages` es `Math.ceil(total / limit)` y vale 0 si no existen registros. Una página posterior a la última devuelve un arreglo vacío y conserva el número solicitado y los totales.

## Reutilización en backend

- DTO: `apps/api/src/dtos/common/pagination-query.dto.ts`.
- Contrato genérico: `apps/api/src/common/types/pagination.type.ts` (`PaginationMeta`, `PaginatedResult<T>`).
- Consulta: `apps/api/src/common/utils/paginate.ts`.

Los módulos pueden extender el DTO común o combinarlo con DTOs de filtros existentes usando `IntersectionType` de Swagger. `UsersQueryDto` combina la paginación con `StatusQueryDto` y conserva su búsqueda específica. No se agregaron filtros genéricos ni ordenamiento configurable.

```ts
const query = repository.createQueryBuilder('record').orderBy('record.id', 'ASC');
// Aplicar aquí los filtros y joins propios del módulo.
return paginate(query, paginationQuery);
```

La utilidad aplica `skip((page - 1) * limit)` y `take(limit)` antes de `getManyAndCount()`. El módulo debe proporcionar ordenamiento estable, con un criterio único para desempatar, y construir sus filtros antes de llamar a la utilidad. No se obtienen todos los registros para recortarlos en memoria. El interceptor existente ya conserva los metadatos y no necesita modificaciones.

## Reutilización en frontend

`apps/web/src/types/pagination.ts` define `PaginationQuery`, `PaginationMeta` y `PaginatedResponse<T>`, extendiendo `ApiResponse<T[]>`. `UsersQuery` extiende el contrato común y `UsersPage` es un alias del resultado genérico.

`apps/web/src/components/pagination/ListPagination.tsx` encapsula `TablePagination` de MUI, conserva el tema de Materio y los textos accesibles en español. Recibe:

- `query`: página actual desde 1 y límite.
- `meta`: totales de la respuesta.
- `onChange`: nuevos parámetros de paginación; el consumidor los combina con sus filtros.
- `pageSizeOptions`: tamaños disponibles; por defecto `[10, 25, 50]`. Un único tamaño mantiene la paginación sin selector de tamaño.
- `disabled`: permite deshabilitar controles durante una petición.
- `labelRowsPerPage`: texto adaptable a cada listado.

El componente convierte internamente a las páginas desde 0 de MUI. Cambiar el tamaño vuelve a la página 1. No realiza peticiones HTTP; estas continúan centralizadas en los servicios existentes mediante el cliente Axios.

```tsx
<ListPagination
  query={query}
  meta={result.meta}
  onChange={(pagination) => setQuery(current => ({ ...current, ...pagination }))}
/>
```

Usuarios mantiene el efecto que solicita datos cuando cambian los parámetros, cancela la aplicación de respuestas obsoletas, muestra loading y errores, conserva estado y búsqueda al navegar y ajusta la página si una operación reduce los resultados. Acciones, permisos, roles y visualización se mantienen. No se migraron otros módulos.

## Archivos modificados o nuevos

Backend: los tres elementos compartidos anteriores, `dtos/users/users-query.dto.ts`, `services/users/users.service.ts` y las pruebas `common/utils/paginate.spec.ts` y `dtos/common/pagination-query.dto.spec.ts`.

Frontend: `types/pagination.ts`, `types/users.ts`, `components/pagination/ListPagination.tsx`, su prueba `ListPagination.test.tsx`, `views/users/UsersAdministration.tsx` y su prueba existente `UsersAdministration.status.test.tsx`.

Documentación: este archivo y una referencia en `docs/hu-usr-04-users.md`.

## Pruebas y verificaciones

Las nuevas pruebas verifican primera página, página intermedia, última página, página fuera de rango, ausencia de resultados, valores por defecto, límite máximo, parámetros inválidos y herencia de filtros/validaciones. Comprueban que se limita la consulta antes de ejecutarla y que los metadatos son correctos.

En frontend se comprueban conversión de índices, total mostrado, navegación, cambio de tamaño, estado vacío, deshabilitación de controles y peticiones mediante el servicio de usuarios conservando los filtros. Se ejecutan además las suites existentes de usuarios, autenticación y permisos.

La prueba de la pantalla utiliza el patrón existente de simulación de estado y efectos para comprobar loading durante el cambio de página, sustitución de registros, conservación de filtros y renderizado de resultados vacíos.

Resultados locales del 11 de octubre de 2026: 106 pruebas backend (23 suites) y 49 pruebas frontend (8 archivos), exitosas. Builds de backend y frontend exitosos. El build mantiene el aviso previo de datos antiguos de `baseline-browser-mapping`, sin impedir la compilación.

Lint, formato, TypeScript del frontend y `git diff --check` también pasan. Al reutilizar el harness de pruebas de usuarios se ajustaron sus tipos de `Box`, callback de búsqueda y fixture de datos sensibles, sin cambiar el comportamiento de negocio. Después de esos ajustes se repitieron lint, formato y las 22 pruebas de ese archivo, exitosas.

Checks aplicables: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build` y `git diff --check`. Las pruebas usan repositorios simulados y renderizado estático/handlers de componentes; no reemplazan una validación en PostgreSQL real o una prueba interactiva de navegador. La CI remota requiere publicar la rama.
