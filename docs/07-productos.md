# Fase 7 — CRUD de Productos

Estado: **✅ aprobado** (2026-08-05), verificado por el usuario en
navegador (crear, editar, buscar, desactivar).

## 1. Objetivo

CRUD completo de productos: crear, listar (con búsqueda y paginación),
ver detalle, editar, desactivar. **Sin stock todavía** — eso es Fase 9;
esta fase no toca `stockMovements` ni `stockLevels` para nada.

**Decisión confirmada por el usuario:** el modelo de `products` (Fase 3)
pedía `categoryId`/`brandId`/`unitId` como obligatorios, pero Categorías/
Marcas/Unidades recién se gestionan en Fase 8. Se relajan a **opcionales**
por ahora — un producto puede crearse sin esos datos y completarse cuando
exista Fase 8. Es el único cambio respecto al modelo aprobado en Fase 3.

## 2. Justificación técnica

- **Paginación por cursor**, no `skip/limit` — ya decidido en Fase 3
  (principio 5), se implementa recién ahora que hay un listado real.
- **Concurrencia optimista** (`version`) en la edición — ya decidido en
  Fase 3; el cliente debe enviar la versión que tenía, 409 si no coincide.
- **Soft delete** (`active: false`, nunca `deleteOne`) — un producto puede
  terminar referenciado por movimientos de stock en Fase 9; borrarlo de
  verdad rompería ese historial futuro. "Eliminar" en la UI en realidad
  desactiva.
- **Categoría/marca/unidad no aparecen en el formulario todavía** (aunque
  el modelo ya las soporta como opcionales): no hay ninguna fuente de
  datos para poblar esos selectores hasta Fase 8 — mostrar un dropdown
  vacío sería peor que no mostrarlo. Se agregan al formulario cuando Fase
  8 exista.
- **Precio/costo como `Decimal128`** en Mongo (ya decidido en Fase 3, para
  evitar errores de redondeo) — la API los expone como **string** en JSON
  (nunca `number`), porque `Decimal128` no serializa nativamente y un
  `number` de JS pierde precisión decimal exacta.

## 3. Arquitectura

- Nuevo módulo `apps/api/src/modules/products/`, mismo patrón de capas que
  `auth`/`dashboard` (schemas → service → routes).
- **Primer uso real del middleware `authorize`** de Fase 5 (ya existía,
  sin consumidor): `product:create`, `product:update`, `product:delete`
  ya estaban definidos como permisos desde Fase 3/5.
- Frontend: reemplaza el placeholder `ComingSoon` de `/productos` (Fase 6)
  por la pantalla real. Nuevos componentes en `packages/ui` (se agregan
  porque esta pantalla los necesita, no antes): `Input`, `Textarea`,
  `Table` + `Pagination`, `Drawer` (Radix `Dialog` estilado como panel
  lateral, no como modal centrado).

## 4. Diseño UI/UX

Reutiliza los mockups de "Tabla de productos" y "Formulario" de Fase 2,
con un ajuste: el badge de estado de esta fase es **Activo/Inactivo**, no
"En stock/Agotado" — ese badge de inventario real llega en Fase 9; usarlo
ahora mostraría datos de stock inventados.

- **Alta/edición en un Drawer lateral** (no una pantalla aparte): la tabla
  queda visible detrás, menos fricción para cargar varios productos
  seguidos — coherente con el patrón Linear/Notion de la dirección de
  diseño.
- Campos del formulario en esta fase: nombre, SKU, descripción, código de
  barras, precio, costo, activo. **Categoría/marca/unidad no se muestran**
  (razón en la sección 2).
- Búsqueda con debounce sobre el índice de texto de Fase 3 (nombre, SKU,
  código de barras).
- Confirmación antes de desactivar un producto (acción destructiva desde
  la perspectiva del usuario, aunque técnicamente sea reversible).

## 5. Modelo de datos

Aplica `products` de Fase 3 con el único ajuste de la sección 1:
`categoryId`, `brandId`, `unitId` pasan de `required: true` a opcionales.
Sin cambios en índices (`{companyId,sku}` único, índice de texto,
`{companyId,active,name}`).

## 6. API

| Método y ruta | Body / Query | Respuesta | Permiso |
|---|---|---|---|
| `GET /products` | `?cursor&limit&q&active` | `{ items[], nextCursor }` | autenticado |
| `POST /products` | `{ sku, name, ... }` | `201 { product }` | `product:create` |
| `GET /products/:id` | — | `{ product }` | autenticado |
| `PATCH /products/:id` | `{ version, ...campos }` | `{ product }` (409 si versión no coincide) | `product:update` |
| `DELETE /products/:id` | — | `204` (soft delete) | `product:delete` |

## 7. Seguridad

Todas las rutas exigen `authenticate`; mutaciones exigen además
`authorize('product:xxx')`. Todas las queries van scoped por `companyId`
del token, reforzado por `tenantScopePlugin`. Validación de body con
TypeBox en cada ruta — nunca se confía en el shape del JSON recibido.

## 8. Código

- **Backend:** `apps/api/src/db/models/product.model.ts` (modelo con
  `tenantScopePlugin`, índices de Fase 3), `apps/api/src/modules/products/`
  (`product.schemas.ts`, `product.service.ts` con paginación por cursor
  tipo *seek* sobre `(name, _id)`, `product.routes.ts` — primer consumidor
  real de `authorize()`, escrito en Fase 5 pero sin usar hasta ahora).
- **`packages/ui`** suma: `Input`/`Textarea`, `FormField`, `Switch` (Radix),
  `Table`/`Th`/`Td`, `Pagination`, `Drawer` (Radix `Dialog` estilado como
  panel lateral).
- **Frontend:** `apps/web/src/pages/ProductsPage.tsx` (tabla + búsqueda con
  debounce + paginación por cursor con pila de cursores para "Anterior"),
  `apps/web/src/features/products/{api.ts,ProductFormDrawer.tsx}`. Los
  botones de crear/editar/desactivar se ocultan si el usuario no tiene el
  permiso correspondiente (el backend ya lo exigía; mostrar un botón que
  siempre falla con 403 es mala UX).
- `packages/shared-types`: `Product`, `ProductListResponse`.

## 9. Testing y verificación

- **8 tests automatizados nuevos** (`apps/api/test/products.test.ts`,
  mismo patrón que fases anteriores): permisos por endpoint (403 sin el
  permiso correcto), creación con precio/costo como string, SKU duplicado
  (409), concurrencia optimista (edita con versión vieja → 409), soft
  delete (desactivar no borra, permite reactivar), **paginación por cursor
  recorrida de punta a punta verificando que no hay huecos ni repetidos**,
  y aislamiento entre empresas (otra empresa no ve estos productos). 21
  tests de backend en total (11 Fase 5 + 2 Fase 6 + 8 Fase 7), todos en
  verde. `lint`/`typecheck`/`build` de los 5 paquetes en verde.
- **Incidente real durante la verificación (infraestructura, no código):**
  al levantar el servidor para la prueba en navegador, `mongoPlugin` no
  conectaba a MongoDB Atlas — la conexión TCP abría pero el handshake TLS
  se cortaba con `SSL alert: internal error` en los tres nodos del
  cluster. Se descartó whitelist de IP (confirmado "Active" en el proyecto
  correcto), cambio de red y antivirus con inspección SSL. Se resolvió
  solo tras un rato — consistente con una demora de propagación o
  mantenimiento transitorio del lado de Atlas, no un problema de esta
  aplicación. Se documenta por si vuelve a pasar: si `mongoPlugin` tira
  `AVV_ERR_PLUGIN_EXEC_TIMEOUT`, probar una conexión aislada con
  `serverSelectionTimeoutMS` alto para ver el error real (el mensaje
  genérico de Fastify solo dice "no arrancó a tiempo").
- Probado por el usuario en el navegador: crear, editar, buscar y
  desactivar un producto, todo funcionando.

## 10. Revisión

**Terminado:** CRUD completo de productos (crear, listar con búsqueda y
paginación por cursor, editar con concurrencia optimista, desactivar sin
borrar), permisos por acción, aislamiento por tenant, componentes nuevos
de `packages/ui` reutilizables para las fases siguientes (Categorías en
Fase 8 va a necesitar Table/Drawer/FormField otra vez).

**Falta:** sin carga de imágenes (no hay object storage configurado
aún). Sin historial de cambios visible en la UI (el campo `version` y
`updatedBy` ya se guardan, pero no hay pantalla de auditoría — no estaba
pedida para esta fase).

**Podría mejorarse:** la búsqueda de texto no está paginada (tope de 50
resultados) — aceptado como límite razonable para un primer corte, se
revisita si hace falta en Fase 14.

**Adenda (2026-08-05, tras aprobar Fase 8):** el formulario de productos
ya muestra los selectores de categoría/marca/unidad que quedaron
pendientes al cerrar esta fase — `CreateProductBodySchema`/
`UpdateProductBodySchema` (`apps/api/src/modules/products/product.schemas.ts`)
aceptan ahora `categoryId`/`brandId`/`unitId` opcionales (`null` en el
update para quitar la referencia), y `ProductFormDrawer.tsx` los
renderiza con el nuevo `Select` de `packages/ui`. Se encontró y corrigió
un bug de AJV en el camino: con `coerceTypes` (default de Fastify), un
`Union([String, Null])` con `String` primero coacciona un `null` entrante
a `""` antes de intentar la rama `Null`, y Mongoose revienta al castear
`""` como `ObjectId`. Fix: `Union([Null, String])` con `Null` primero, en
`product.schemas.ts` y `category.schemas.ts` (Fase 8 tenía el mismo bug
latente sin test que lo cubriera). 9 tests de backend en total para
productos (8 + 1 nuevo cubriendo el vínculo con categoría/marca/unidad).
