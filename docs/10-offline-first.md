# Fase 10 — Offline First (recorte inicial: Productos + Movimientos)

Estado: **en curso** (2026-08-05).

## 1. Objetivo

Que un operador pueda **navegar el catálogo de productos (con su stock
actual) y registrar movimientos de stock (entrada/salida/ajuste) sin
conexión**, con sincronización automática al reconectar. Es el recorte
inicial de Offline First — decisión explícita del usuario (ver sección
2) — sobre la arquitectura híbrida ya aprobada en Fase 1.

**Alcance de este recorte:**
- **Productos: solo lectura offline.** El catálogo (nombre, SKU, precio,
  costo, stock) queda cacheado localmente y navegable/buscable sin red.
  Crear/editar/desactivar un producto **sigue requiriendo conexión**
  (botones deshabilitados si está offline).
- **Movimientos: alta en cola offline.** Registrar una entrada/salida/
  ajuste funciona sin red — se guarda en una cola local (*outbox*) y se
  sincroniza solo cuando hay conexión.
- **Kardex y feed de movimientos recientes: requieren conexión** (son
  vistas de consulta ocasional, no el flujo de todos los días — se
  excluyen deliberadamente de este recorte).

**Fuera de alcance de este recorte** (decisión explícita del usuario):
- Categorías, Marcas, Unidades y el Panel siguen con fetch directo, sin
  caché ni cola offline.
- UI de resolución de conflictos LWW (ver sección 2, ítem "conflictos de
  versión") — se **diseña** en esta fase porque se preguntó y se decidió,
  pero **no se construye código** porque este recorte no incluye ninguna
  edición offline de datos maestros que pueda dispararla. Queda lista
  para cuando se extienda el alcance (Categorías/Marcas/Unidades, o
  edición offline de Productos).
- Background Sync API del Service Worker (sincronizar con la pestaña
  cerrada) — se sincroniza en foreground (al reconectar con la pestaña
  abierta, al abrir la app, o con el botón manual). Soporte de
  navegadores desparejo (no en Safari/iOS) y complejidad de mensajería
  SW↔página no se justifican para el primer recorte.
- PWA "instalable" (ícono en pantalla de inicio, auditoría Lighthouse) —
  el objetivo es que la app funcione sin red, no que se instale como
  app nativa. El manifest queda mínimo, sin set de íconos.

## 2. Justificación técnica

- **Arquitectura de sync: ya decidida en Fase 1** (Decisión 4, sección 6
  de [docs/01-arquitectura.md](docs/01-arquitectura.md)), no se
  re-discute: híbrido — **log de eventos append-only** para movimientos
  de stock (conflictos imposibles por diseño) + **LWW con `version`** para
  datos maestros. Esta fase es la primera que le da código real a esa
  decisión.
- **Recorte a Productos (lectura) + Movimientos (escritura en cola)**
  (decisión explícita del usuario, opción recomendada): hacer offline
  las 5+ pantallas existentes de una implicaría reescribir la capa de
  datos de cada una contra Dexie + un motor de sync en un solo paso —
  mucha superficie para el primer intento de una arquitectura nueva.
  Productos + Movimientos es el flujo real de un operador de depósito
  sin señal; Categorías/Marcas/Unidades son datos de alta infrecuente,
  se extienden después.
- **Los movimientos SIEMPRE pasan por la cola (outbox), estén online o
  no.** No hay dos caminos de código ("si hay red, llamar directo; si
  no, encolar") — siempre se escribe primero a Dexie y se intenta
  sincronizar en el momento; si hay red, la cola se vacía casi
  instantáneamente y es indistinguible de un alta directa. Esto es
  literalmente el patrón que docs/01 ya describía ("toda escritura se
  guarda primero en una cola local... se aplica de forma optimista...")
  y además simplifica el código: un solo mecanismo maneja tanto "sin
  red" como "con red pero inestable/lenta", en vez de dos.
- **`clientMutationId` (Fase 9) ya deja resuelta la idempotencia del
  lado del servidor** — la cola local genera el UUID en el momento de
  encolar (no al sincronizar), así que reintentos por corte de red no
  duplican movimientos. No hace falta ningún mecanismo nuevo del lado
  del servidor para esta fase.
- **Falla real y concreta que sí puede pasar en este recorte: un
  movimiento encolado offline se rechaza al sincronizar** (por ejemplo,
  `insufficient_stock` porque otro dispositivo ya vendió ese stock
  mientras este estaba offline). No es un conflicto de versión LWW (los
  movimientos no tienen versión, son un log de eventos) — es una regla
  de negocio que ya no se cumple al momento de sincronizar. Se resuelve
  con la misma filosofía simple que se decidió para conflictos LWW
  (sección "UI de conflictos" más abajo, decisión explícita del
  usuario): el movimiento pasa a un estado "con error", visible en la
  UI con el motivo exacto del servidor, nunca se descarta en silencio ni
  se reintenta indefinidamente — el usuario decide si lo edita y
  reintenta o lo descarta.
- **UI de conflictos LWW: simple (descartar o sobrescribir), no editor
  campo por campo** (decisión explícita del usuario). docs/03 daba por
  hecho que esta UI ya estaba diseñada en Fase 2 — no era cierto (sin
  grep positivo en `docs/02-diseno-ui-ux.md`), se diseña recién ahora.
  Como se explica en "Alcance", no se construye en este recorte por
  falta de un flujo que la dispare — queda documentada para cuando haga
  falta.
- **Optimismo en la UI** (ya definido en Fase 1): al encolar un
  movimiento, el stock cacheado localmente se ajusta de inmediato
  (aritmética simple en el cliente, solo para mostrar — nunca se
  persiste ese cálculo; lo persistido siempre sale del `$inc` de Mongo
  en el servidor, igual que ya se decidió en Fase 9 para la validación
  de stock negativo). Si el movimiento después se rechaza al
  sincronizar, ese ajuste optimista se revierte y el valor real
  (delta-sincronizado del servidor) vuelve a mandar.
- **Service Worker con `vite-plugin-pwa` (wrapper de Workbox sobre
  Vite)** en vez de escribir un `sw.js` a mano — se integra con el build
  de Vite (hashing de assets, invalidación de caché en cada deploy) en
  vez de mantenerlo por separado. **Precachea solo el shell de la app**
  (JS/CSS/HTML del build) — a propósito **no** cachea respuestas de la
  API a nivel de Service Worker. Son dos trabajos distintos: el SW
  responde "¿la app carga sin red?", Dexie responde "¿los datos están
  disponibles y sincronizados correctamente?" — mezclarlos arriesga
  mostrar una respuesta de API vieja servida por el SW sin que la UI
  sepa que está desactualizada, sin pasar por el estado de sync que la
  UI sí conoce.
- **Delta sync de productos vía `updatedSince` en el `GET /products`
  existente**, no un módulo de sync nuevo — reutiliza la ruta, el
  scoping por tenant y la paginación que ya existen. En modo delta se
  ignoran `q`/`active` (hace falta *todo* lo que cambió, incluyendo
  productos recién desactivados, para que el caché local se entere) y
  se ordena por `updatedAt` en vez de por `name`. No hace falta manejar
  "tombstones" de borrado: los productos nunca se borran de verdad
  (soft-delete), así que un producto desactivado simplemente llega en el
  delta con `active:false`, igual que cualquier otro cambio.
- **`GET /stock-levels` (Fase 9) se reutiliza tal cual** para refrescar
  el stock cacheado — se pide el lote completo de productos cacheados en
  cada sync en vez de diseñar un delta específico para stock: al volumen
  esperado (decenas a un par de cientos de productos) es más simple y
  igual de barato que inventar otro mecanismo de cursor.
- **Nueva infraestructura de testing en `apps/web`** (no existía
  ninguna): el motor de sync es exactamente el tipo de lógica donde un
  bug sutil es caro y difícil de ver a simple vista (igual que las
  transacciones de Fase 9 justificaron `MongoMemoryReplSet`). Se agrega
  Vitest + `fake-indexeddb` (IndexedDB en memoria para Node, compatible
  con Dexie) para probar el motor de sync sin navegador.

## 3. Arquitectura

- **Backend:** `product.schemas.ts`/`product.service.ts` (Fase 7) suman
  el modo delta (`updatedSince`) al `list()` existente — sin rutas
  nuevas, sin módulos nuevos.
- **Frontend**, todo nuevo bajo `apps/web/src/offline/`:
  - `db.ts` — base Dexie (`StockCOfflineDB`) con tablas `products`,
    `stockLevels`, `outboxMovements`, `meta` (bookkeeping del cursor de
    sync).
  - `connectivity.ts` — hook `useOnlineStatus()` sobre
    `navigator.onLine` + eventos `online`/`offline`.
  - `syncEngine.ts` — `pullProducts()`, `pullStockLevels()`,
    `pushOutbox()`, `runSync()` (orquesta: primero *push* del outbox,
    después *pull* de productos/stock, para que el caché local ya
    refleje el efecto de los movimientos recién sincronizados). Se
    dispara al reconectar, al montar la app, y con un botón manual.
  - `queueMovement()` — único punto de entrada para crear un movimiento;
    siempre escribe a `outboxMovements` primero (ver sección 2).
- `dexie-react-hooks` (paquete oficial chico) para `useLiveQuery()` —
  evita reinventar la suscripción reactiva a Dexie a mano.
- `ProductsPage`/`MovementsPage` pasan a leer de Dexie (vía
  `useLiveQuery`) en vez de `fetch` directo; el `fetch` directo sigue
  existiendo dentro de `syncEngine.ts`, que es el único lugar que le
  habla a la API para estas dos colecciones.
- Badge de estado (En línea / Sin conexión / Sincronizando, con contador
  de pendientes) reutiliza el `Badge` de `packages/ui` — no hace falta
  un componente de diseño nuevo, solo dónde se monta.

## 4. Diseño UI/UX

- **Badge de conectividad** en el `Topbar`, siempre visible: "En línea"
  (verde), "Sincronizando… (N)" (info, mientras `pushOutbox`/`pull` están
  en vuelo), "Sin conexión" (neutral/gris) — nunca alarmante en rojo,
  estar offline es un estado soportado, no un error.
- **Productos:** si está offline, "Nuevo producto"/"Editar"/"Desactivar"
  quedan deshabilitados con un tooltip ("Necesitás conexión para editar
  productos"); la tabla, la búsqueda (ahora filtrando el caché local en
  el cliente) y el stock siguen andando igual. **Sin paginación por
  cursor** — el motivo original de la paginación por cursor (Fase 7) era
  evitar `skip/limit` sobre una consulta *remota*; acá la tabla ya lee un
  array que está entero en memoria (el caché local completo), así que
  "paginar" dejó de tener sentido — se renderiza la lista completa
  filtrada, ordenada por nombre.
- **Nuevo movimiento:** sin cambios visibles en el formulario — la
  diferencia (cola vs. alta directa) es invisible para el usuario salvo
  por el badge de estado y la lista de pendientes.
- **Pendientes/errores de sincronización:** en `/movimientos`, arriba
  del feed, una sección "Pendientes de sincronizar" (mientras hay
  elementos en el outbox) y "Con error" (movimientos rechazados al
  sincronizar, con el motivo tal cual lo dio el servidor y botones
  "Reintentar" / "Descartar"). Nunca desaparecen solos.
- **Kardex** ("Ver kardex" en Productos): si está offline, el botón
  queda deshabilitado con el mismo tooltip que edición — es una consulta
  al servidor, no está cacheado en este recorte.

## 5. Modelo de datos

**Servidor:** sin cambios de esquema — reutiliza `products` (Fase 7,
`updatedAt` ya existe) y `stockMovements`/`stockLevels` (Fase 9) tal
cual.

**Cliente (IndexedDB vía Dexie), nuevo:**

| Tabla | Campos clave | Uso |
|---|---|---|
| `products` | `id` (PK), `sku`, `name`, `updatedAt`, resto de campos del `Product` | Espejo local de la Fase 7, para lectura offline |
| `stockLevels` | `productId` (PK), `quantity` | Espejo local de Fase 9 |
| `outboxMovements` | `localId` (PK autoincremental), `clientMutationId`, `productId`, `type`, `quantity`, `reason?`, `reference?`, `createdAt`, `status` (`pending\|syncing\|failed`), `errorMessage?` | Cola de movimientos, única vía de escritura |
| `meta` | `key` (PK), `value` | Cursor de la última sync de productos (`updatedAt` + `id` del último visto) |

## 6. API

Sin rutas nuevas — un query param nuevo en una ruta existente:

| Método y ruta | Cambio | Respuesta |
|---|---|---|
| `GET /products` | nuevo `?updatedSince=<ISO>` (junto con `cursor`/`limit` existentes) — modo delta: ignora `q`/`active`, incluye inactivos, ordena por `updatedAt` | `{ items[], nextCursor }` (mismo shape que hoy) |

`POST /stock-movements` y `GET /stock-levels` (Fase 9) se usan sin
cambios desde `syncEngine.ts`.

## 7. Seguridad

Sin cambios de superficie: el modo delta de `GET /products` pasa por el
mismo `authenticate` + `tenantScopePlugin` que el modo normal — un
dispositivo offline solo puede sincronizar contra la empresa de su
propio token. Los datos cacheados en IndexedDB quedan en el dispositivo
del usuario sin cifrar (limitación conocida de IndexedDB en general, no
específica de esta app) — aceptable para este recorte porque son datos
de catálogo (nombre, precio, stock), no credenciales ni datos
personales; se documenta como algo a revisar si en el futuro se cachea
información más sensible.

**Encontrado en el camino, no pedido explícitamente pero necesario:**
IndexedDB no sabe nada de tenants — si el usuario A (empresa X) cierra
sesión en un dispositivo y el usuario B (empresa Y) inicia sesión
después en el mismo navegador, sin ninguna limpieza el caché de A
quedaría visible momentáneamente para B. `logout()` en `AuthContext.tsx`
ahora llama a `clearOfflineData()` (vacía las 4 tablas de Dexie) antes de
limpiar la sesión.

## 8. Código

- **Backend:** `product.schemas.ts` (+`updatedSince`), `product.service.ts`
  (+modo delta en `list()`).
- **Frontend:** `apps/web/src/offline/{db,connectivity,syncEngine,
  useOfflineSync,SyncStatusBadge}.ts(x)`; `ProductsPage.tsx`/
  `MovementsPage.tsx`/`MovementFormDrawer.tsx` reescritos contra Dexie/el
  outbox; badge de conectividad en `AppShell.tsx`; `AuthContext.tsx`
  limpia el caché offline al cerrar sesión (ver sección 7); `vite.config.ts`
  suma `VitePWA`; `features/products/api.ts` suma el param `updatedSince`.
- Nuevas dependencias: `dexie`, `dexie-react-hooks`, `vite-plugin-pwa`
  (+ `vitest`, `fake-indexeddb` como devDependencies de `apps/web`).

## 9. Testing y verificación

- **5 tests nuevos de frontend** (primera vez que `apps/web` tiene test
  runner): `apps/web/src/offline/syncEngine.test.ts` con Vitest +
  `fake-indexeddb` — encolar un movimiento y sincronizar lo limpia del
  outbox; un rechazo del servidor (mockeado) lo deja `failed` con el
  motivo exacto y no se reintenta solo; una falla de red (sin respuesta
  del servidor) lo deja `pending` para reintentar, no `failed`; el ajuste
  optimista de stock se revierte si el movimiento falla; el cursor de
  delta-sync avanza entre llamadas separadas sin repetir productos.
- **2 tests nuevos de backend** en `apps/api/test/products.test.ts` para
  el modo `updatedSince` (incluye productos recién desactivados, excluye
  cambios previos al corte, pagina sin huecos ni repetidos ordenado por
  `updatedAt`). **46 tests de backend en total.**
- `lint`/`typecheck`/`build`/`test` de los 5 paquetes en verde.
- Verificación manual en navegador: **pendiente**, a cargo del usuario —
  con las DevTools en modo "Offline", navegar Productos (debe seguir
  mostrando el catálogo cacheado), registrar un movimiento (debe quedar
  "pendiente" en el badge y en `/movimientos`), volver a "Online" y
  confirmar que sincroniza solo; forzar un rechazo (ej. una salida mayor
  al stock disponible cargada offline) para ver que cae en "Con error"
  en vez de desaparecer, y que "Reintentar"/"Descartar" funcionan.

## 10. Revisión

Pendiente de completar — se llena después de la verificación en
navegador y la aprobación del usuario, mismo formato que
`docs/09-control-inventario.md`.
