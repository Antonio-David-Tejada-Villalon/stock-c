# Fase 11 — Reportes

Estado: **✅ aprobado** (2026-08-06), verificado por el usuario en
navegador con datos reales (San Juan, Argentina, ferretería — ver
`apps/api/src/db/seed.ts`).

## 1. Objetivo

Dar visibilidad agregada sobre el inventario actual y su movimiento
histórico. El sistema todavía no tiene ventas, compras ni POS, así que
los reportes de esta fase solo pueden salir de datos que ya existen:
productos (con precio/costo), categorías/marcas/unidades, movimientos de
stock y niveles de stock. Alcance confirmado con el usuario (4 reportes,
los 4 con exportación a CSV):

1. **Valorización de inventario** — stock × costo por producto, agrupado
   por categoría/marca, con total general.
2. **Movimientos por rango de fechas** — vista agregada de entradas/
   salidas/ajustes de todos los productos (a diferencia del kardex de
   Fase 9, que es uno por uno), filtrable por tipo/fecha/categoría.
3. **Resumen por categoría/marca** — cuántos productos activos hay y cómo
   se distribuye el stock.
4. **Stock bajo / quiebre de stock** — requiere un campo nuevo
   (`minStock`, opcional) en Producto, que no existía. Sin él, un
   producto simplemente no participa del reporte (no se asume 0 por
   default — evita falsos positivos para productos a los que nunca se
   les cargó un umbral).

Todos los reportes se ven en pantalla y se pueden descargar en CSV.

## 2. Justificación técnica

- **Agregación síncrona, no jobs en background.** El prompt maestro
  (`docs/01-arquitectura.md`) menciona workers separados (BullMQ) para
  "generación de reportes" a futuro, pero a esta escala (una empresa,
  fase de desarrollo, sin datos masivos) un job en cola es complejidad
  prematura. Si un reporte se vuelve pesado en producción, es un tema de
  Fase 14 (Optimización), no de esta fase.
- **`.find()` tenant-scoped + agrupación en memoria, no `.aggregate()`.**
  `tenantScopePlugin` (`db/plugins/tenantScope.ts`) es el cinturón de
  seguridad multiempresa del proyecto — pero solo engancha `find`/
  `findOne`/`countDocuments`/etc., **no** `.aggregate()` (los hooks de
  Mongoose no cubren el pipeline de agregación). Escribir un `$match`
  manual a mano en cada reporte duplicaría, sin red de seguridad, algo
  que el proyecto ya resolvió una vez. En vez de eso, los 4 servicios de
  reportes usan `.find({ companyId, ... })` (protegido por el plugin,
  igual que el resto del código) y agrupan/suman en Node — mismo patrón
  que ya usa `dashboard.routes.ts`. A esta escala de datos (una empresa)
  no hay diferencia de performance real.
- **CSV se genera en el cliente**, a partir de los mismos datos que ya se
  trajeron para pintar la tabla en pantalla — evita una segunda ruta de
  API por reporte y un viaje de red extra. No hay volumen todavía que
  justifique streaming de CSV desde el servidor.
- **`minStock` opcional, mismo patrón que `cost`** (`docs/07-productos.md`):
  un producto sin `minStock` cargado no entra al reporte de stock bajo,
  en vez de asumir un umbral de 0 que generaría falsos negativos (todo
  quedaría "bien" aunque el stock esté en cero).
- **Sin permiso nuevo.** Los endpoints de reportes son de solo lectura,
  igual que `GET /products`, `GET /stock-movements` y `GET /stock-levels`
  — ninguno de esos exige un permiso `*_READ` (el modelo de permisos de
  Fase 5 solo controla mutaciones: `product:create`, `inventory:movement:
  create`, etc.). Un endpoint de reportes de solo lectura sigue el mismo
  criterio: requiere sesión autenticada, no un permiso extra.
- **Reportes de movimientos: rango de fechas obligatorio + tope de
  resultados (5000).** Sin esto, un cliente podría pedir "todos los
  movimientos desde siempre" de una empresa con años de historial — un
  límite de seguridad simple, no una funcionalidad nueva.

## 3. Arquitectura

Nuevo módulo `apps/api/src/modules/reports/` (schemas + service + routes,
mismo patrón que `modules/inventory`), 4 endpoints GET, todos resuelven
la única sucursal activa igual que Fase 9 (`resolveActiveBranch`, mismo
criterio: sin sucursal activa exactamente, no hay reporte de stock que
mostrar).

En el frontend, `/reportes` deja de ser `ComingSoon` y pasa a ser
`ReportsPage` con `Tabs` (mismo patrón que `/categorias`), un tab por
reporte, cada uno con su tabla y un botón "Descargar CSV" que usa una
utilidad compartida (`apps/web/src/lib/csv.ts`) sobre los datos ya
cargados en pantalla — no pega a la API de nuevo para exportar.

## 4. Diseño UI/UX

Reutiliza componentes existentes de `packages/ui` (`Tabs`, `Table`, `Th`/
`Td`, `EmptyState`, `Badge`, `Button`, `Input` para fechas) — sin
componentes nuevos en el sistema de diseño, salvo la utilidad de CSV
(no es un componente visual). Cada tab: filtros arriba si aplican (rango
de fechas + tipo para Movimientos), botón "Descargar CSV" a la derecha
del título, tabla con subtotales donde corresponde (categoría/marca) y
total general al pie.

## 5. Modelo de datos

Un solo campo nuevo: `Product.minStock?: Decimal128` (mismo patrón que
`cost` — string decimal en la API, `Decimal128` en Mongo, sin migración
de datos existentes porque es opcional).

## 6. API

Todos requieren sesión autenticada (`authenticate`), sin permiso extra
(ver sección 2). Todos devuelven datos ya resueltos (nombres de
categoría/marca/producto/usuario vía `Map`, mismo patrón que
`dashboard.routes.ts`) — el frontend no arma joins.

- **`GET /reports/inventory-valuation`** — sin query params. Devuelve
  `items` (producto, cantidad, costo, valor = cantidad × costo — excluye
  productos sin costo cargado, cuenta cuántos se excluyeron),
  `byCategory`, `byBrand` (subtotales) y `grandTotal`.
- **`GET /reports/movements?dateFrom&dateTo&type&categoryId`** —
  `dateFrom`/`dateTo` obligatorios (ISO date). Devuelve `items` (hasta
  5000, con `truncated: boolean` si se cortó) y `totalsByType`.
- **`GET /reports/catalog-summary`** — sin query params. Devuelve
  `byCategory`, `byBrand` (cantidad de productos activos + stock total
  por cada uno) y los totales generales activos/inactivos.
- **`GET /reports/low-stock`** — sin query params. Devuelve `items`:
  productos con `minStock` cargado y `quantity <= minStock`, con el
  déficit calculado.

## 7. Seguridad

- Multiempresa: los 4 servicios usan `.find({ companyId, ... })`
  (`tenantScopePlugin` sigue cubriendo la query, a diferencia de un
  `.aggregate()` manual — ver sección 2) y agrupan en memoria, nunca
  exponen datos de otra empresa.
- Sin permiso nuevo (ver justificación en sección 2) — solo sesión
  autenticada.

## 8. Código

**Encontrado durante el cierre de esta fase:** el Panel (`DashboardPage.tsx`)
tenía la tarjeta "Stock bajo" como placeholder honesto desde la adenda de
Fase 9 ("necesita un umbral de stock mínimo por producto — todavía no
diseñado"). Con `minStock` ya construido acá, ese texto quedó
desactualizado — se conectó `DashboardSummary.lowStockCount` (nuevo campo)
reutilizando `reportService.lowStock()` en `dashboard.routes.ts`, con el
mismo criterio de degradar a 0 (no romper el panel) si la sucursal activa
es ambigua, igual que `movementsTodayCount`.


- `apps/api/src/db/helpers/resolveActiveBranch.ts` (nuevo, extraído de
  `stockMovement.service.ts`) — la sucursal única implícita se necesita
  en 4 reportes más, no solo en Fase 9; `stockMovement.service.ts` se
  actualizó para usarlo (con un wrapper `resolveBranch` que traduce el
  error al código que ya esperaban sus rutas).
- `apps/api/src/lib/decimal.ts` (nuevo) — aritmética decimal exacta vía
  `bigint` de punto fijo (4 decimales): `addDecimal`, `subDecimal`,
  `multiplyDecimal`, `compareDecimal`, `ZERO_DECIMAL`. Sin esto, sumar
  costos/cantidades en JS con `Number()` arrastra error de punto
  flotante — inaceptable en un reporte de valorización.
- `apps/api/src/modules/reports/report.schemas.ts` — schemas TypeBox de
  los 4 endpoints.
- `apps/api/src/modules/reports/report.service.ts` — los 4 métodos de
  agregación, todos con `.find({ companyId, ... })` + `Map`/loop en
  memoria (ver sección 2, ninguno usa `.aggregate()`).
- `apps/api/src/modules/reports/report.routes.ts` — 4 rutas GET,
  registradas en `app.ts`.
- `Product.minStock` — nuevo en `db/models/product.model.ts`,
  `product.schemas.ts` (create/update/view) y `product.service.ts`
  (`toView`, `create`); `packages/shared-types` (`Product.minStock`) y
  `ProductFormDrawer.tsx` (campo "Stock mínimo", mismo patrón que
  "Costo").
- `apps/web/src/lib/csv.ts` — `toCsv`/`downloadCsv` genéricos (con BOM
  UTF-8 para que Excel no rompa acentos/ñ), usados por los 4 reportes.
- `apps/web/src/features/reports/` — `api.ts` (cliente HTTP),
  `format.ts` (`formatMoney`/`formatQty`, mismo patrón ya usado en
  Productos/Movimientos/Panel), `CsvDownloadButton.tsx`,
  `InventoryValuationPanel.tsx`, `MovementsReportPanel.tsx`,
  `CatalogSummaryPanel.tsx`, `LowStockPanel.tsx`.
- `apps/web/src/pages/ReportsPage.tsx` (nuevo, reemplaza el `ComingSoon`
  de `/reportes`) — `Tabs` con los 4 reportes, mismo patrón que
  `CatalogsPage`.

## 9. Testing

`apps/api/test/reports.test.ts` (nuevo, 8 tests, `MongoMemoryServer`
standalone — sin transacciones, los fixtures de `stockLevels`/
`stockMovements` se siembran directo con los modelos, no vía el service
transaccional de Fase 9):

- Valorización: solo activos con costo, agrupa por categoría, cuenta
  excluidos; sin permiso extra (`viewerToken` con permisos vacíos).
- Movimientos: filtra por rango de fechas y por categoría; rechaza un
  rango invertido (`dateFrom > dateTo`) con 400.
- Resumen: cuenta activos/inactivos, balde "sin categoría".
- Stock bajo: solo productos con `minStock` cargado y por debajo del
  umbral; calcula el déficit.
- Aislamiento por empresa: otra empresa no ve nada en sus reportes.

54 tests de backend en verde (46 previos + 8 nuevos). 5 tests de
frontend sin cambios (no se tocó el motor de sync offline).
`lint`/`typecheck`/`build` en verde en las 5 paquetes del monorepo.

## 10. Revisión

**Terminado:** los 4 reportes (Valorización, Movimientos, Resumen, Stock
bajo), todos con CSV; `Product.minStock` opcional; la tarjeta "Stock
bajo" del Panel dejó de ser un placeholder. Verificado en navegador con
datos reales por el usuario: matemática de valorización correcta
($5.200 + $2.600 = $7.800 con Martillo/Cable), filtros de Movimientos
(tipo + categoría) devolviendo el subconjunto correcto, Resumen sumando
8 productos activos entre categorías y marcas, CSV de Stock bajo abierto
en Excel con acentos/ñ intactos ("eléctrico").

**Qué falta:** nada bloqueante para esta fase. La adenda de Categorías
(código/ícono/color/imagen/orden) quedó pospuesta por decisión del
usuario — ver `CLAUDE.md`, sección "Pendiente anotado para después de
Fase 11".

**Qué podría mejorarse (no bloquea, no se toca sin pedirlo):**
- Generación de CSV en el servidor (streaming) si algún día los reportes
  manejan volúmenes que el cliente no pueda procesar cómodo — hoy es
  prematuro (ver sección 2).
- Reportes por sucursal si el proyecto extiende multisucursal real más
  allá de la sucursal única implícita de Fase 9.
- Filtro por rango de fechas en Valorización (hoy es una foto del
  momento actual, no histórica).
