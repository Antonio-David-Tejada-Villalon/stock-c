# Fase 8 — Categorías, Marcas, Unidades

Estado: **✅ aprobado** (2026-08-05), verificado por el usuario en
navegador y con datos de ejemplo cargados (categorías, marcas, unidades y
productos de San Juan, Argentina — ver `apps/api/src/db/seed.ts`).

## 1. Objetivo

CRUD de las tres tablas maestras que el modelo de Fase 3 ya definía pero
que Fase 7 no pudo pedir como obligatorias por no existir todavía:
**Categorías** (con jerarquía en árbol), **Marcas** y **Unidades**. Esta
fase no toca el formulario de productos — eso queda como paso siguiente
una vez aprobada esta fase (dejado explícito en `CLAUDE.md`).

**Decisiones confirmadas por el usuario para esta fase:**
- Categorías: **árbol sin límite de profundidad** (no solo un nivel) —
  cualquier categoría puede tener otra como padre, sin tope de niveles.
- Desactivar una categoría/marca/unidad **no se bloquea** aunque haya
  productos activos que la referencien — igual que el soft-delete de
  productos en Fase 7, se permite igual y el producto conserva la
  referencia como dato histórico.

## 2. Justificación técnica

- **Árbol sin límite → validación de ciclos obligatoria en el backend.**
  Si el cliente pudiera asignar como padre a un descendiente propio (o a
  sí misma), la categoría quedaría inalcanzable desde la raíz y cualquier
  recorrido del árbol entraría en loop infinito. El servicio valida esto
  en cada `create`/`update` que toque `parentId`, caminando hacia arriba
  desde el padre propuesto: si el recorrido llega al propio documento,
  se rechaza con `400 cycle`.
- **`categories.name` no es único** (a diferencia de `brands`/`units`) —
  así lo definió Fase 3 explícitamente (solo índice no-único
  `{companyId,name}`, contra "único por colección" en brands/units). Tiene
  sentido: "Tornillos" puede repetirse como subcategoría de "Ferretería" y
  de "Jardín". No se agrega una restricción de unicidad que Fase 3 no
  pidió.
- **Brands y Units son estructuralmente idénticos** (`name`, `active`,
  `version` — Units solo suma `abbreviation` opcional) y sin jerarquía.
  Se factoriza su lógica de servicio y de rutas en un módulo genérico
  reutilizable (`modules/catalogs/simpleCatalog.*`) en vez de duplicar
  list/create/update/deactivate dos veces — es duplicación real (dos
  módulos completos, no "tres líneas parecidas"). Categorías, al tener
  lógica propia (`parentId`, ciclos), **no** usa ese factory: mismo patrón
  de capas que `products` (Fase 7), pero módulo separado.
- **En el frontend no se generaliza el formulario** de Marca/Unidad pese a
  ser casi idénticos: dos componentes de presentación pequeños y
  concretos (`BrandFormDrawer`, `UnitFormDrawer`) son más legibles que una
  abstracción parametrizada para ahorrar ~15 líneas — la duplicación que
  se evita en el backend (lógica de negocio) no aplica igual de bien a
  JSX de formulario.
- **Sin paginación por cursor en estas tres colecciones.** El principio 5
  de Fase 3 pide evitar `skip/limit` para *listados grandes* (mencionaba
  explícitamente productos y movimientos, con miles de filas esperadas).
  Categorías/marcas/unidades son datos de catálogo — decenas, como mucho
  unos pocos cientos por empresa. Se listan completas (tope defensivo de
  500/1000 registros) ordenadas por nombre, sin cursor. Si algún día una
  empresa tuviera miles de categorías, migrar a cursor es un cambio
  acotado al `service.list()` de cada módulo, no una reescritura.
- **Permisos nuevos como strings libres**, mismo esquema que Fase 5/7:
  `category:create/update/delete`, `brand:create/update/delete`,
  `unit:create/update/delete`. Como el seed de roles arma `Owner`/`Admin`
  con `Object.values(PERMISSIONS)`, no hace falta tocar `seed.ts` — los
  roles de sistema ya existentes reciben los permisos nuevos
  automáticamente.

## 3. Arquitectura

- Tres módulos backend nuevos bajo `apps/api/src/modules/`:
  - `categories/` (`category.schemas.ts`, `category.service.ts` con
    validación de ciclos, `category.routes.ts`) — capas propias, sin
    generic factory, por la lógica de jerarquía.
  - `catalogs/` — módulo compartido: `simpleCatalog.service.ts` (factory
    genérico `createSimpleCatalogService<TDoc,...>(model, toView)`) y
    `simpleCatalog.routes.ts` (factory `registerSimpleCatalogRoutes(app,
    opts)`), más `brand.module.ts` y `unit.module.ts` — archivos finos que
    solo declaran schemas TypeBox específicos y llaman a ambos factories
    con el modelo Mongoose correspondiente.
- Reutiliza `tenantScopePlugin` (Fase 3/5) y `authorize()` (Fase 5, ya
  consumido desde Fase 7) sin cambios.
- Frontend: nueva pantalla `/categorias` con tres pestañas (Radix
  `Tabs`, nuevo en `packages/ui`) — Categorías / Marcas / Unidades — en
  vez de tres rutas separadas, porque son pantallas chicas y relacionadas
  que un usuario típicamente completa en una sola sesión de carga inicial
  (coherente con el patrón de configuración agrupada de Linear/Notion).
  Nuevo `Select` en `packages/ui` (select nativo estilado, mismo lenguaje
  visual que `Input`) para el selector de categoría padre — reutilizable
  en Fase 7-bis para los selectores de categoría/marca/unidad en el
  formulario de productos.
- El árbol de categorías se recibe **plano** del backend (`{id, name,
  parentId, ...}[]`) y se arma/aplana en el cliente para mostrarlo
  indentado por profundidad — evita que el backend tenga que decidir un
  formato de árbol anidado que el cliente after tendría que volver a
  aplanar para una tabla simple.

## 4. Diseño UI/UX

- Misma dirección visual que Fase 6/7 (Linear/Notion): pestañas simples
  arriba, tabla + botón "Nueva/o [recurso]" a la derecha, alta/edición en
  `Drawer` lateral — reutiliza el patrón ya validado en Productos.
- **Categorías:** tabla con indentación visual por nivel (`—` repetido
  según profundidad) para representar el árbol sin necesitar un
  componente de árbol colapsable nuevo. El formulario tiene un selector
  "Categoría padre" (vacío = categoría raíz) que excluye la propia
  categoría y sus descendientes de las opciones — primera línea de
  defensa contra ciclos en la UI misma; el backend es la autoridad final.
- **Marcas / Unidades:** tabla simple (nombre, abreviatura en Unidades,
  estado, acciones), mismo patrón que Categorías sin la columna de
  jerarquía.
- Botones de crear/editar/desactivar ocultos según permisos, igual que
  Productos.
- Confirmación antes de desactivar, igual que Productos (acción percibida
  como destructiva aunque sea reversible).

## 5. Modelo de datos

Aplica `categories`/`brands`/`units` de Fase 3 sin cambios:
- `categories`: `companyId`, `name`, `parentId?` (self-ref), `active`,
  `version`, timestamps. Índices `{companyId,parentId}` ·
  `{companyId,name}` (no únicos).
- `brands` / `units`: `companyId`, `name` (+ `abbreviation?` en `units`),
  `active`, `version`, timestamps. Índice `{companyId,name}` único por
  colección.

## 6. API

| Método y ruta | Body / Query | Respuesta | Permiso |
|---|---|---|---|
| `GET /categories` | `?active` | `{ items[] }` (plano, sin cursor) | autenticado |
| `POST /categories` | `{ name, parentId? }` | `201 { category }` | `category:create` |
| `GET /categories/:id` | — | `{ category }` | autenticado |
| `PATCH /categories/:id` | `{ version, name?, parentId?, active? }` | `{ category }` (409 si versión no coincide, 400 `cycle`/`invalid_parent`) | `category:update` |
| `DELETE /categories/:id` | — | `204` (soft delete) | `category:delete` |
| `GET/POST/GET :id/PATCH :id/DELETE :id` | análogo | análogo | `brand:*` |
| `GET/POST/GET :id/PATCH :id/DELETE :id` | análogo (+ `abbreviation?`) | análogo | `unit:*` |

## 7. Seguridad

Todas las rutas exigen `authenticate`; mutaciones exigen además
`authorize('category|brand|unit:xxx')`. Todas las queries van scoped por
`companyId` del token, reforzado por `tenantScopePlugin`. Validación de
body con TypeBox en cada ruta. La validación de ciclos en categorías
corre **en el servidor**, nunca se confía en que el cliente haya filtrado
bien las opciones del selector.

## 8. Código

- **Backend:** `apps/api/src/db/models/{category,brand,unit}.model.ts`;
  `apps/api/src/modules/categories/*`; `apps/api/src/modules/catalogs/*`
  (factory + `brand.module.ts` + `unit.module.ts`).
- **`packages/ui`** suma `Tabs` (Radix) y `Select`.
- **Frontend:** `apps/web/src/pages/CatalogsPage.tsx` +
  `apps/web/src/features/catalogs/{api.ts, CategoryFormDrawer.tsx,
  BrandFormDrawer.tsx, UnitFormDrawer.tsx, CategoriesPanel.tsx,
  BrandsPanel.tsx, UnitsPanel.tsx}`.
- `packages/shared-types`: `Category`, `Brand`, `Unit` y sus
  `*ListResponse`, más los 9 permisos nuevos.

## 9. Testing y verificación

- **11 tests automatizados nuevos** (`apps/api/test/catalogs.test.ts`):
  permisos por endpoint (403 sin el permiso correcto), creación de
  categoría raíz y subcategoría, padre inexistente (400
  `invalid_parent`), **detección de ciclos** (asignar como padre a un
  descendiente propio → 400 `cycle`), concurrencia optimista y soft
  delete en categorías, nombre duplicado en marcas (409
  `duplicate_name`), soft delete de marcas, creación de unidad con
  abreviatura, permiso `unit:delete`, y aislamiento por tenant en las
  tres colecciones. **32 tests de backend en total** (11 Fase 5 + 2 Fase
  6 + 8 Fase 7 + 11 Fase 8), todos en verde.
- `lint`/`typecheck`/`build`/`test` de los 5 paquetes en verde.
- Verificación manual en navegador: hecha por el usuario, con datos de
  ejemplo reales (`pnpm seed` extendido — 6 categorías con jerarquía, 4
  marcas, 4 unidades, 8 productos con sabor a San Juan/Cuyo, marcas
  ficticias no asociadas a empresas reales).

## 10. Revisión

**Terminado:** CRUD completo de Categorías (con árbol de profundidad
ilimitada y validación de ciclos en el servidor), Marcas y Unidades;
permisos por acción; aislamiento por tenant; `packages/ui` suma `Tabs` y
`Select`, reutilizables en fases siguientes; factory genérico de catálogo
(`modules/catalogs/simpleCatalog.*`) que evitó duplicar la lógica CRUD de
Marcas y Unidades. 32 tests de backend en total (21 previos + 11 de esta
fase), todos en verde. Datos de ejemplo cargados en la base de desarrollo
para facilitar pruebas futuras.

**Falta:** nada bloqueante — el pendiente de agregar los selectores de
categoría/marca/unidad al formulario de productos (Fase 7) se resolvió el
mismo día, ver adenda en
[docs/07-productos.md](docs/07-productos.md#10-revisión).

**Podría mejorarse:** el árbol de categorías se solo indenta con texto
(`└`) en vez de un componente de árbol colapsable — aceptable para el
volumen esperado (decenas de categorías), se revisita si hace falta.
