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
  `unit:create/update/delete`. El seed de roles arma `Owner`/`Admin` con
  `Object.values(PERMISSIONS)` — ⚠️ **esta afirmación original resultó
  incorrecta**, ver el incidente real documentado en la adenda de
  Categorías más abajo: un rol de sistema ya existente **no** recibía
  permisos nuevos automáticamente (`$setOnInsert` solo aplica al crear el
  documento), recién se corrigió ahí.

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

---

## Adenda — Enriquecimiento de Categorías (2026-08-06)

### Objetivo

El usuario pidió ampliar Categorías con `código`, `ícono`, `color`,
`imagen` y orden manual (hoy se listan alfabético). Explícitamente
**no** un sistema genérico de atributos dinámicos/EAV — campos
concretos, mismo criterio que ya usó esta fase al no generalizar el
formulario de Marca/Unidad (sección 2). El árbol sin límite de
profundidad ya cubre jerarquías tipo Categoría/Subcategoría/Familia/
Línea sin cambios — no se agrega un campo "Nivel" fijo, sería un techo
más rígido que lo que ya existe.

### Justificación técnica — 3 decisiones confirmadas por el usuario

- **Imagen: solo URL, sin subida de archivos.** El proyecto no tiene
  ningún object storage configurado (ni ruta de subida, ni proveedor,
  ni componente — `Product.images` existe en el modelo desde Fase 7 pero
  nunca se conectó a nada, ver `docs/07-productos.md`). Construir subida
  real (Vercel Blob u otro proveedor) es una decisión de infraestructura
  propia, no un efecto colateral de esta adenda — se pospone. `imageUrl`
  es un campo de texto validado como URL, el usuario aloja la imagen en
  otro lado.
- **Ícono: librería `lucide-react`, no emoji libre.** Encaja con la
  dirección de diseño ya fijada (Linear/Vercel/Notion, "nada de
  Bootstrap genérico", `CLAUDE.md`). Se guarda un string clave (nombre
  del ícono, ej. `"Wrench"`) — el registro de íconos disponibles vive en
  el frontend (`categoryIcons.ts`), curado a ~40 íconos relevantes para
  retail/inventario en vez de exponer los +1500 de la librería entera
  (mejor UX que un buscador sobre todo el catálogo, y permite tree-shake
  real importando cada ícono por nombre). El backend no valida contra una
  lista cerrada — solo tope de longitud — para no acoplar el schema a una
  versión específica de la librería del frontend.
- **Orden: flechas arriba/abajo, no drag-and-drop.** Reordenar
  categorías es una acción poco frecuente — no justifica sumar una
  librería de drag-and-drop (`@dnd-kit` u otra) y la complejidad de UI
  que conlleva. Las flechas intercambian el campo `order` con el
  hermano (mismo `parentId`) adyacente — mismo patrón visual que los
  botones de texto que ya tiene la tabla (Editar/Desactivar).

Además: **`código` único por empresa, pero opcional** — índice
`{companyId, code}` único con `partialFilterExpression: { code: {
$exists: true, $type: "string" } }`. Categorías existentes sin código no
rompen nada; dos categorías *con* código no pueden repetirlo.

**Incidente real durante el testing de esta adenda:** el primer intento
usó `sparse: true` en vez de `partialFilterExpression` — parecía lo obvio
("índice disperso" es justo el término para "único pero opcional"). Los
tests fallaban en cadena con `409 duplicate_code` en la *segunda*
categoría creada sin código, aunque ninguna de las dos mandaba `code` en
absoluto. Causa real: **`sparse` en un índice *compuesto* de Mongo no
excluye un documento salvo que falten *todos* sus campos indexados** —
y `companyId` siempre está presente, así que el documento entra al
índice igual, con `code` tratado como `null`, y dos "null" chocan contra
la restricción `unique`. Es un comportamiento documentado de MongoDB,
no un bug de Mongoose. `partialFilterExpression` no tiene esa
ambigüedad: excluye exactamente los documentos que no cumplen el filtro
que uno declara, sin importar qué otros campos tengan. Se reprodujo
aislado con un script descartable antes de aplicar el fix, para
confirmar la causa exacta antes de tocar el modelo real.

### Arquitectura

- `order` es un entero **scoped a `(companyId, parentId)`** — el orden
  compara hermanos entre sí, no categorías de ramas distintas del árbol
  (no tendría sentido comparar la posición de "Aguas" dentro de
  "Bebidas" contra la de "Quesos" dentro de "Lácteos"). Al crear una
  categoría nueva, se calcula automáticamente como
  `max(order de los hermanos existentes) + 1` (o `0` si es la primera).
- Nuevo endpoint `POST /categories/:id/move` (`{ direction: "up" |
  "down" }`) hace el intercambio de `order` con el hermano adyacente.
  Es un intercambio de 2 documentos sin transacción de Mongo — a
  diferencia de `stockMovements` (Fase 9, financieramente crítico), acá
  el peor caso de una carrera es un orden visual momentáneamente
  inconsistente, no pérdida de datos; no se justifica la complejidad de
  una transacción para esto.
- `flattenTree` (frontend) no cambia — ya preservaba el orden de llegada
  del array dentro de cada grupo de hermanos; alcanza con que el backend
  ordene por `{order: 1}` en vez de `{name: 1}`.
- `apps/web/src/features/catalogs/categoryIcons.ts` (nuevo): registro
  `Record<string, LucideIcon>` curado + lista para el selector.

### Diseño UI/UX

- Tabla de Categorías: cada fila suma un punto de color (si hay `color`)
  y el ícono (si hay `icon`) antes del nombre; `código` se muestra como
  texto secundario mono debajo del nombre (mismo patrón visual que SKU
  en Productos). Flechas ▲/▼ en la columna de acciones, deshabilitadas
  en los extremos del grupo de hermanos.
- Formulario: selector de ícono como grilla de botones con buscador
  simple (filtra por nombre); color con `<input type="color">` nativo +
  fila de swatches preset (los inputs de color nativos son feos/
  inconsistentes entre navegadores — los presets dan una salida rápida
  sin duplicar esfuerzo). Vista previa chica de la imagen si `imageUrl`
  es una URL válida.
- El `<select>` de categoría en el formulario de Productos **no** se
  toca — un `<option>` nativo no puede pintar ícono/color de forma
  confiable entre navegadores; el enriquecimiento visual queda acotado a
  la pantalla de gestión de Categorías. Límite de alcance explícito, no
  un descuido.

### Modelo de datos

`categories` suma:
- `code?: string` — único por `{companyId, code}` vía índice parcial
  (ver "Incidente real" en Justificación técnica).
- `icon?: string` — nombre de ícono de `lucide-react`, sin validar
  contra lista cerrada en el servidor (ver justificación técnica).
- `color?: string` — hex `#RRGGBB`, validado por patrón.
- `imageUrl?: string` — URL, tope de longitud.
- `order: number` — no opcional, default `0`, scoped a
  `(companyId, parentId)` (ver arquitectura).

### API

| Método y ruta | Body | Respuesta |
|---|---|---|
| `POST /categories` | suma `code?, icon?, color?, imageUrl?` opcionales | `order` se calcula server-side, no es parte del body |
| `PATCH /categories/:id` | suma los mismos 4 campos opcionales | igual que antes (409/400 sin cambios) |
| `POST /categories/:id/move` (nuevo) | `{ direction: "up" \| "down" }` | `204`; `400 already_at_edge` si no hay hermano en esa dirección |

### Seguridad

`POST /categories/:id/move` exige `authorize(category:update)` — es
semánticamente una edición. Sin cambios al resto del modelo de permisos
ni al aislamiento por `companyId` (mismos mecanismos que el resto de la
fase).

### Código

- **Backend:** `apps/api/src/db/models/category.model.ts` (campos +
  índice parcial), `apps/api/src/modules/categories/{category.schemas.ts,
  category.service.ts, category.routes.ts}` (campos nuevos, `order`
  automático, `move()`, `POST /categories/:id/move`).
- **Frontend:** `apps/web/src/features/catalogs/categoryIcons.ts`
  (registro curado, nuevo), `IconPicker.tsx` (nuevo), `api.ts`
  (`moveCategory` + campos nuevos), `CategoryFormDrawer.tsx` (campos
  código/ícono/color/imagen), `CategoriesPanel.tsx` (ícono/color/código
  en la tabla + flechas de orden).
- `packages/shared-types`: `Category` suma `code?`, `icon?`, `color?`,
  `imageUrl?`, `order`.
- Nueva dependencia: `lucide-react` en `apps/web`.

### Testing

**3 tests nuevos** en `apps/api/test/catalogs.test.ts` (dentro de
`describe("Categorías")`): creación con los 4 campos nuevos + rechazo de
código duplicado (`409 duplicate_code`); dos categorías pueden limpiar su
código sin chocar entre sí (confirma que el índice parcial excluye
`code` ausente, no solo `null`); `order` automático al crear hermanos +
`POST /:id/move` intercambia el orden + `400 already_at_edge` en el
límite. **57 tests de backend en total** (54 previos + 3 nuevos), todos
en verde. 5 tests de frontend sin cambios. `lint`/`typecheck`/`build` de
los 5 paquetes en verde.

**Incidente real durante la verificación en navegador (no relacionado al
código de esta adenda):** el usuario reportó que no aparecían los
botones "Nueva categoría"/Editar/Desactivar — ni en Categorías, Marcas
o Unidades, tres pantallas de las cuales solo la primera se tocó en esta
adenda. Se descartó primero sesión vencida (el usuario cerró sesión y
reinició frontend/backend, sin cambios). Causa real:
`apps/api/src/db/seed.ts` construye los roles de sistema (`Owner`,
`Admin`, etc.) con un `findOneAndUpdate(..., { $setOnInsert: {
permissions } }, { upsert: true })` — `$setOnInsert` solo escribe ese
campo la **primera vez** que el documento se crea. El rol `Owner` de la
empresa real de desarrollo (`ferreteria-demo`) ya existía desde una fase
temprana; cuando fases posteriores (Fase 8 en adelante) agregaron
permisos nuevos a `PERMISSIONS`, ese rol ya existente nunca los recibió,
así que `category:create`/`update`/`delete` (y lo mismo para
`brand:*`/`unit:*`) jamás estuvieron en su lista real de permisos —
pese a que `docs/08` (ver sección "Justificación técnica" arriba)
afirmaba lo contrario. **Fix:** `$setOnInsert` → `$set`, para que cada
corrida de `pnpm seed` sincronice los permisos del rol con el
`PERMISSIONS` actual del código, no solo al crearlo. Corregir esto
requiere que el usuario vuelva a correr `pnpm --filter @stock-c/api
seed` contra su base real para que el rol `Owner` ya existente reciba
los permisos que le faltaban — el fix de código por sí solo no
retroactivamente actualiza un documento que ya está en Atlas.

**Segundo incidente real, mismo patrón:** una vez visibles los botones,
el usuario reportó que las flechas ▲/▼ de la tabla de Categorías no
movían nada visualmente, aunque la llamada a `POST /:id/move` no
fallaba. Causa: las categorías de `ferreteria-demo` se crearon en
Fase 8, **antes** de que existiera el campo `order` de esta adenda —
`ensureCategories()` las upsertea con `$setOnInsert: {}`, que nunca
tocó `order` en documentos ya existentes, así que las 8 categorías
sembradas quedaron todas en el default `0`. `move()` intercambia
`order` entre dos hermanos correctamente, pero intercambiar `0` por
`0` no cambia nada observable. **Fix:** igual que el incidente
anterior, `ensureCategories()` pasó de `$setOnInsert` a `$set` para
`order`, asignando valores secuenciales explícitos por grupo de
hermanos (`{companyId, parentId}`) en cada corrida — backfillea los
documentos ya existentes en vez de solo cubrir altas nuevas. Requiere,
otra vez, que el usuario corra `pnpm --filter @stock-c/api seed` contra
la base real para que el backfill se aplique.

**Descartado, fuera de alcance de esta adenda:** el usuario había
propuesto en paralelo reemplazar el árbol de categorías de ejemplo
(ferretería) por uno de rubro almacén/supermercado, y de paso
productos/marcas de ejemplo a tono. Decisión final del usuario: **no**
— esa idea de datos de ejemplo pertenece a otro proyecto, no a
STOCK-C. Los datos de ejemplo siguen siendo el árbol de ferretería
original de Fase 8, sin cambios de contenido — solo el backfill de
`order` descripto arriba.

### Revisión

**Terminado:** los 4 campos nuevos de Categoría (`code`, `icon`,
`color`, `imageUrl`) con su formulario, la tabla enriquecida
(color/ícono/código por fila), `order` scoped a `(companyId, parentId)`
con endpoint `POST /categories/:id/move` y flechas ▲/▼ en la UI.
57 tests de backend en verde. Dos incidentes reales encontrados y
corregidos durante la verificación en navegador (permisos de rol no
sincronizados vía `$setOnInsert`, y `order` sin backfill para
categorías preexistentes) — ambos con la misma causa raíz (`$setOnInsert`
solo escribe al crear) y la misma solución (`$set` en el seed).

**Tercer y cuarto incidente real, verificación en navegador:** (1) un
documento puntual (`Clavos`, creado a mano por el usuario mientras el
servidor todavía corría el código viejo) quedó con `order: 0` empatado
con un hermano — reparado con una escritura de un solo documento,
acotada por `_id`, después de confirmar por lectura directa (sola
lectura, sin tocar nada) que el código de `nextOrder()` en el repo ya
calcula bien; causa raíz: el proceso del servidor de la API no se había
reiniciado desde que se agregó el campo `order`, así que corría la
versión anterior de `create()`. (2) el mismo desfasaje de proceso
explicaba un mensaje de error genérico ("No se pudo guardar") al
mandar un código de categoría repetido, en vez del mensaje específico
que el código ya tenía armado — se resolvió reiniciando el servidor,
sin cambios de código. **Lección para la sesión:** después de editar
`category.service.ts`/`category.routes.ts`, reiniciar el proceso de
`pnpm --filter @stock-c/api dev` en vez de asumir que el watch mode
recargó.

Además, verificación en navegador expuso que `imageUrl` no se veía en
ningún lado fuera del propio formulario — gap real de UX, no solo
cosmético. **Fix:** la fila de la tabla de Categorías ahora muestra una
miniatura de 24×24 si la categoría tiene `imageUrl` (mismo lugar que ya
mostraba color e ícono).

**Falta:** nada bloqueante. Todo verificado en navegador por el
usuario: flechas ▲/▼, código/ícono/color/imagen (con miniatura visible
en la tabla), rechazo de código duplicado con mensaje claro. `lint`/
`typecheck`/`build`/`test` (57 tests de backend) en verde.

**Podría mejorarse:** nada identificado más allá de lo ya anotado en
la sección 10 de la Fase 8 original (árbol solo indentado con texto).
