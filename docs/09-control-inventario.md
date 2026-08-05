# Fase 9 — Control de Inventario (entradas, salidas, kardex)

Estado: **✅ aprobado** (2026-08-05), verificado por el usuario en
navegador (entrada, salida, ajuste con motivo obligatorio, kardex,
columna de stock, y bloqueo de stock negativo).

## 1. Objetivo

Registrar movimientos de stock por producto (entrada, salida, ajuste) y
consultar el **kardex** (historial ordenado e inmutable) de cada
producto, con el stock actual siempre disponible. Es la primera fase que
le da contenido real a `stockMovements`/`stockLevels`, definidos en Fase
3 pero sin código hasta ahora.

**Fuera de alcance de esta fase** (decisiones explícitas del usuario,
detalladas en la sección 2):
- **Multi-sucursal real.** Se asume la única sucursal activa de la
  empresa; no hay CRUD de sucursales ni selector en la UI todavía.
- **Transferencias entre sucursales** (tipo `transferencia` del modelo de
  Fase 3) — no tiene sentido sin multi-sucursal real.
- **Valuación/costeo de inventario** (FIFO, promedio ponderado, costo de
  mercadería vendida) — no estaba pedido por el nombre de la fase; el
  modelo de `stockMovements` de Fase 3 ni siquiera lleva un campo de
  costo por movimiento. Se evalúa si hace falta en una fase futura.

## 2. Justificación técnica

- **Sucursal única implícita** (decisión explícita del usuario, opción
  recomendada): hoy `Branch` existe como modelo pero sin CRUD, sin
  selector en la UI y sin "sucursal activa" en el JWT — el seed solo crea
  una (`CENTRAL`). Construir CRUD + selector de sucursal sin que ninguna
  pantalla lo necesite todavía sería exactamente el tipo de trabajo no
  pedido que las reglas del proyecto prohíben. El backend resuelve la
  sucursal automáticamente (`Branch.findOne({companyId, active:true})`)
  y **falla explícitamente** (`500` con mensaje claro, no elige "cualquiera"
  en silencio) si hay 0 o más de 1 sucursal activa — mejor un error ruidoso
  ahora que dejar movimientos mal atribuidos si en el futuro alguien crea
  una segunda sucursal antes de que exista el selector real.
- **Tipos de movimiento: entrada, salida y ajuste** (decisión explícita
  del usuario) — `ajuste` es necesario porque el kardex es *append-only*
  (Fase 1/3): si alguien carga mal una cantidad, la única forma correcta
  de corregirlo sin editar ni borrar el movimiento original es registrar
  un `ajuste` que lo compense, tal como ya lo documentaba
  [docs/03-modelo-datos.md](docs/03-modelo-datos.md#310-stockmovements-kardex--append-only-fuente-de-verdad).
  `transferencia` queda fuera (ver sección 1).
- **Aclaración necesaria al modelo de Fase 3 — signo de `quantity` en
  `ajuste`.** Fase 3 dice "`quantity` siempre positivo; el signo lo da
  `type`", pero no especifica qué signo tiene un `ajuste` (a diferencia de
  `entrada`/`salida`, que son inequívocos). Sin esa aclaración `ajuste` no
  se puede implementar. Se resuelve así: `entrada`/`salida` mantienen
  `quantity > 0` con el signo implícito en `type` (`+`/`-`); `ajuste` es
  el único tipo donde `quantity` puede ser positivo (suma stock) o
  negativo (resta stock) — el signo ya lo lleva el valor, no hace falta
  un campo extra. Es una aclaración de un caso que Fase 3 dejó abierto,
  no una contradicción de una decisión ya tomada.
- **Stock negativo bloqueado** (decisión explícita del usuario, opción
  recomendada): una salida o un ajuste negativo que dejaría el stock por
  debajo de cero se rechaza con `400 insufficient_stock`. Fuerza a
  corregir la carga (por ejemplo, cargar la entrada faltante primero) en
  vez de dejar que el kardex refleje un estado físicamente imposible.
- **`sequence` reutiliza `stockLevels.lastSequence` como contador
  atómico.** Fase 3 ya define `lastSequence` en `stockLevels` como "último
  `sequence` de `stockMovements` reflejado aquí" — es exactamente el
  contador que `sequence` necesita. Un solo `findOneAndUpdate` con
  `$inc: { quantity: delta, lastSequence: 1 }` (upsert) devuelve el
  siguiente `sequence` sin necesitar una colección de contadores aparte.
- **Transacción multi-documento** (ya decidido en Fase 3, Decisión 2,
  opción A): insertar el `stockMovement` y actualizar el `stockLevel`
  correspondiente ocurre en una única transacción de Mongo. El patrón
  concreto es: dentro de la transacción, leer el `stockLevel` actual,
  validar que no quede negativo, aplicar el `$inc` atómico (que también
  asigna `sequence`), e insertar el movimiento con ese `sequence`. Si dos
  operadores cargan movimientos del mismo producto al mismo tiempo, Mongo
  detecta el conflicto de escritura y el driver reintenta la transacción
  completa automáticamente (`session.withTransaction`) — la validación de
  stock negativo se vuelve a evaluar en cada reintento sobre el estado
  fresco, así que la condición de carrera no puede colarse.
- **Comparación numérica solo para la validación de "no negativo", nunca
  para lo que se guarda.** El valor persistido sale siempre de un `$inc`
  nativo de Mongo sobre `Decimal128` (exacto). Para decidir si bloquear la
  operación se convierte a `Number` únicamente en memoria — no se guarda
  ese valor. Es una simplificación deliberada (evita sumar una dependencia
  de aritmética decimal solo para una comparación de signo) aceptable
  para cantidades de inventario, no para dinero.
- **`clientMutationId` generado desde ahora**, aunque Fase 10 (Offline
  First) es la que trae sincronización real: es barato generarlo ya en el
  frontend (`crypto.randomUUID()`) y dejar funcionando el mecanismo de
  idempotencia que Fase 3 ya diseñó (índice único
  `{companyId, clientMutationId}`) — si una request se reintenta por un
  corte de red, el segundo intento no duplica el movimiento, devuelve el
  ya existente. Evita tener que tocar el modelo otra vez en Fase 10.

## 3. Arquitectura

- Nuevo módulo `apps/api/src/modules/inventory/` (`stockMovement.schemas.ts`,
  `stockMovement.service.ts`, `stockMovement.routes.ts`), mismo patrón de
  capas que `products`/`categories`.
- Nuevos modelos `apps/api/src/db/models/{stockMovement,stockLevel}.model.ts`
  implementando lo ya aprobado en Fase 3 (con la aclaración de la sección 2
  sobre el signo de `quantity` en `ajuste`).
- Reutiliza `tenantScopePlugin`, `authorize()` y el permiso
  `inventory:movement:create` (ya definido desde Fase 3/5, sin consumidor
  hasta ahora).
- Frontend: la ruta `/movimientos` (reservada desde Fase 6 con un
  `ComingSoon`) pasa a ser la pantalla real — feed de movimientos
  recientes + alta de movimientos. Se agrega un endpoint de stock por
  lote (`GET /stock-levels?productIds=...`) para que `ProductsPage`
  (Fase 7) muestre una columna de stock actual sin tocar el módulo de
  productos — separación limpia entre "catálogo" (productos) y
  "inventario" (movimientos/stock).

## 4. Diseño UI/UX

- **`/movimientos`**: tabla de movimientos recientes de toda la empresa
  (fecha, producto, tipo con `Badge`, cantidad con signo, motivo,
  usuario), paginada por cursor, más botón "Nuevo movimiento" que abre un
  `Drawer` (mismo patrón que Productos/Categorías).
- **Formulario "Nuevo movimiento"**: selector de producto, tipo
  (Entrada/Salida/Ajuste), cantidad. Para `Ajuste`, en vez de pedir un
  número con signo (poco intuitivo), se muestra un selector "Sumar
  stock" / "Restar stock" + cantidad positiva — el signo se arma en el
  cliente antes de enviarlo. Motivo obligatorio solo para `Ajuste`
  (validación de UI; el campo es opcional a nivel de API para
  entrada/salida). Referencia opcional (ej. nº de remito).
- **Columna "Stock" en `ProductsPage`** (Fase 7): lectura del nuevo
  endpoint por lote, no bloquea el render de la tabla si tarda (se
  completa cuando llega).
- **Kardex por producto**: botón "Ver kardex" en cada fila de
  `ProductsPage` que abre un `Drawer` de solo lectura con el historial
  paginado de ese producto y el stock actual arriba.
- Si una operación se rechaza por `insufficient_stock`, el formulario
  muestra el stock disponible en el mensaje de error, no solo "no se
  pudo".

## 5. Modelo de datos

Implementa `stockMovements`/`stockLevels` de Fase 3 (detalle completo en
[docs/03-modelo-datos.md](docs/03-modelo-datos.md#310-stockmovements-kardex--append-only-fuente-de-verdad)),
con la única aclaración de la sección 2 (signo de `quantity` en `ajuste`):

- `stockMovements` (append-only, sin `updatedAt`): `companyId`,
  `branchId`, `productId`, `type` (`entrada|salida|ajuste`), `quantity`
  (Decimal128; positivo en entrada/salida, positivo o negativo en
  ajuste), `sequence` (Number, asignado por el servidor), `reason?`,
  `reference?`, `clientMutationId` (string, UUID), `createdBy`,
  `clientCreatedAt`, `createdAt`. Índices:
  `{companyId,clientMutationId}` único · `{companyId,branchId,productId,sequence}`
  · `{companyId,branchId,createdAt:-1}`.
- `stockLevels` (caché materializado, no editable directo): `companyId`,
  `branchId`, `productId`, `quantity` (Decimal128), `lastSequence`
  (Number), `updatedAt`. Índice único `{companyId,branchId,productId}`.
  Un producto sin `stockLevel` todavía se interpreta como stock `0`.

## 6. API

| Método y ruta | Body / Query | Respuesta | Permiso |
|---|---|---|---|
| `POST /stock-movements` | `{ productId, type, quantity, reason?, reference?, clientMutationId }` | `201 { movement, stockLevel }` (`200` si `clientMutationId` repetido → devuelve el ya existente, replay idempotente; `400 insufficient_stock`/`invalid_quantity`/`reason_required`) | `inventory:movement:create` |
| `GET /stock-movements` | `?productId&cursor&limit` | `{ items[], nextCursor }` — con `productId`: orden por `sequence` (kardex real); sin `productId`: orden por `createdAt` (feed reciente) | autenticado |
| `GET /stock-levels` | `?productIds=id1,id2,...` (máx. 100) | `{ items: [{ productId, quantity }] }` | autenticado |

## 7. Seguridad

`authenticate` en todas las rutas; `authorize('inventory:movement:create')`
en el alta. Todo scoped por `companyId` vía `tenantScopePlugin`. La
transacción atómica (sección 2) es también una medida de integridad, no
solo de performance: sin ella, dos movimientos concurrentes sobre el
mismo producto podrían pisarse el `sequence` o dejar `stockLevel`
desincronizado. Validación TypeBox de `type` (enum estricto) y `quantity`
(mismo patrón decimal que precio/costo en productos) en cada request.

## 8. Código

- **Backend:** `apps/api/src/db/models/{stockMovement,stockLevel}.model.ts`;
  `apps/api/src/modules/inventory/{stockMovement.schemas,service,routes}.ts`.
- **Frontend:** `apps/web/src/pages/MovementsPage.tsx` (reemplaza el
  `ComingSoon` de `/movimientos`);
  `apps/web/src/features/inventory/{api.ts, MovementFormDrawer.tsx,
  KardexDrawer.tsx}`; columna de stock y botón "Ver kardex" agregados a
  `ProductsPage.tsx`.
- `packages/shared-types`: `StockMovement`, `StockMovementListResponse`,
  `StockLevel`, `DashboardRecentMovement`.
- **Adenda post-verificación (mismo día):** al probar la fase en el
  navegador se encontraron dos textos del Panel (Fase 6) y de la barra
  superior que habían quedado desactualizados — "Productos activos",
  "Stock bajo" y "Movimientos hoy" seguían mostrando "Se activa en la
  Fase 7/9" aunque esas fases ya estaban hechas, y el buscador de la
  barra superior decía literalmente "Buscar producto… (Fase 7)" sin
  funcionar. No era código nuevo, era conectar datos que ya existían:
  `GET /dashboard/summary` (`dashboard.routes.ts`) suma `productCount`,
  `movementsTodayCount` y `recentMovements` (con sucursal única implícita,
  igual que el resto de esta fase — si la sucursal es ambigua, el panel
  no rompe, muestra `0` en vez de `500`, a diferencia de `/stock-movements`
  que sí es una operación de inventario real); `DashboardPage.tsx` ya
  consume esos campos; `AppShell.tsx` cambia el texto muerto por un link
  real a `/productos`. "Stock bajo" queda con un motivo honesto (necesita
  un umbral de stock mínimo por producto, no diseñado en ninguna fase
  todavía) en vez de un placeholder de fase vencida.

## 9. Testing y verificación

- **10 tests automatizados nuevos** (`apps/api/test/inventory.test.ts`):
  permiso `inventory:movement:create`, entrada/salida actualizan
  `stockLevel` correctamente, salida que dejaría stock negativo → `400
  insufficient_stock`, ajuste sin motivo → `400 reason_required`, ajuste
  negativo resta stock, `clientMutationId` repetido no duplica el
  movimiento (devuelve `200` con el ya existente), kardex de un producto
  paginado de punta a punta sin huecos ni repetidos, aislamiento por
  tenant (movimientos y stock-levels), y una empresa con más de una
  sucursal activa falla con `500 no_active_branch`. Más un test nuevo en
  `dashboard.test.ts` para `movementsTodayCount`/`recentMovements` con
  una sola sucursal activa. **44 tests de backend en total** (33 previos
  + 10 Fase 9 + 1 de la adenda del panel), todos en verde.
- **Nota de infraestructura de testing:** las transacciones de Mongo
  requieren un *replica set* (no un `mongod` standalone). Los tests de
  esta fase usan `MongoMemoryReplSet` de `mongodb-memory-server` en vez
  del `MongoMemoryServer` standalone que usaban Fases 5-8 — es la primera
  vez que hace falta, porque es la primera fase con transacciones reales.
  Funcionó sin ajustes adicionales.
- `lint`/`typecheck`/`build`/`test` de los 5 paquetes en verde.
- Verificación manual en navegador, hecha por el usuario: entrada de 20
  sobre "Martillo carpintero 20oz", salida de 5, ajuste de -2 con motivo
  — stock quedó en 13, coincidiendo exactamente con lo esperado; kardex y
  columna de stock reflejaron cada paso; una salida de 999 (mayor al
  stock disponible) fue rechazada con el mensaje de stock insuficiente,
  sin crear el movimiento ni tocar el stock; el Panel mostró
  "Movimientos hoy: 3" y los listó en "Movimientos recientes".

## 10. Revisión

**Terminado:** registro de movimientos (entrada/salida/ajuste) con
transacción atómica, kardex por producto, columna de stock y bloqueo de
stock negativo — verificados de punta a punta en navegador contra la
base real de Atlas. `clientMutationId` deja la idempotencia lista para
Fase 10. De paso se conectó el Panel (Fase 6) y el buscador de la barra
superior a datos reales, cerrando un pendiente que había quedado colgado
desde fases anteriores.

**Falta:** sucursal única implícita (sin CRUD de sucursales ni
selector); tipo `transferencia`; valuación/costeo de inventario; umbral
de "stock bajo" configurable — ninguno estaba pedido para esta fase.

**Podría mejorarse:** el feed general de `/movimientos` no tiene filtro
por producto en la UI (el backend ya lo soporta vía `?productId=`, solo
falta exponerlo); nada bloqueante.
