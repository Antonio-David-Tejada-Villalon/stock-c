# Fase 12 — Notificaciones

Estado: **🟡 en curso**.

## 1. Objetivo

Avisar proactivamente, dentro de la app, sobre dos eventos que hoy el
usuario solo descubre si va a buscarlos a mano:

- **Stock bajo / quiebre de stock**: un producto cruza su umbral
  `minStock` (Fase 11) — hoy solo visible entrando a Reportes → Stock
  bajo o mirando la tarjeta del Panel.
- **Movimiento rechazado al sincronizar (offline)**: un movimiento en
  cola (Fase 10) que falla al sincronizar (ej. `insufficient_stock`)
  hoy solo se ve si el usuario entra a `/movimientos` y mira "Con
  error".

Alcance decidido con el usuario (no un sistema genérico de eventos):
solo estos dos disparadores, entrega **in-app con polling** — sin
email, sin push del navegador, sin WebSockets/SSE.

## 2. Justificación técnica

- **In-app + polling, no tiempo real.** El proyecto no tiene
  infraestructura de tiempo real desplegada (ni conexiones WebSocket
  persistentes desde el API stateless, ni workers/pub-sub sobre el
  Redis de Upstash). Construirla ahora adelantaría trabajo de la
  Fase 14 (Optimización) sin un caso de uso que lo justifique — mismo
  criterio que ya aplicó Fase 1 al dejar el pub-sub de Redis como
  "camino disponible, no activado". Se guardan en Mongo
  (`notifications`) y el cliente pregunta por el contador de no
  leídas cada 45s + al recuperar el foco de la pestaña — mismo
  espíritu que la sync de Fase 10 (dispara en eventos concretos, sin
  timers innecesarios), con el agregado puntual de un intervalo acá
  porque no hay otro evento del cliente que sirva de disparador natural
  para "¿hay algo nuevo?".
- **Lectura por usuario, no por empresa.** Los roles de Fase 5
  (Owner/Admin/Warehouse Operator/Viewer) ya asumen varios usuarios
  activos por empresa. Si el estado de "leída" fuera compartido, un
  usuario marcando una alerta como leída la ocultaría para el resto del
  equipo sin que ellos la hayan visto. Cada notificación guarda
  `readBy: userId[]`; "leída" se calcula por request comparando contra
  el usuario autenticado. Costo extra mínimo (un array) contra un bug
  de UX real.
- **Distinguir "rechazado al sincronizar" de "rechazado en el
  formulario" requiere una señal explícita del cliente.** Investigando
  el código de Fase 9/10 antes de diseñar esto: `pushOutbox()`
  (`apps/web/src/offline/syncEngine.ts`) reintenta un movimiento en
  cola llamando al **mismo** `POST /stock-movements` que usa el
  formulario online — mismo código de servidor, mismo
  `InventoryError`. El servidor no tiene forma de distinguir por sí
  solo "esto viene de la cola offline" de "esto lo tipeó alguien en el
  formulario y se equivocó de cantidad" — y notificar en el segundo
  caso sería ruido (el usuario ya ve el error al instante en el propio
  formulario). Se agrega `source?: "sync"` al body de
  `POST /stock-movements`, que `pushOutbox()` manda y el formulario
  online no — el servidor solo crea la notificación cuando
  `source === "sync"` y la creación falla.
- **La notificación de rechazo no referencia un `StockMovement`
  persistido.** `insufficient_stock` se lanza *antes* de
  `StockMovement.create()` (ver `stockMovement.service.ts`) — un
  movimiento rechazado nunca llega a existir como documento. La
  notificación guarda directamente los datos del intento (producto,
  tipo, cantidad, motivo del rechazo) en vez de una referencia a un
  movimiento que no existe.
- **Detección de cruce, no "está bajo" en cada movimiento.** Si se
  notificara cada vez que el stock post-movimiento está por debajo de
  `minStock`, cada venta subsiguiente mientras el producto sigue bajo
  generaría una notificación nueva — ruido. Se compara la cantidad
  *antes* y *después* del movimiento (ambas ya disponibles dentro de la
  misma transacción de `createMovement()`, Fase 9) y solo se notifica
  en la transición de "ok" a "bajo" (`antes >= minStock && después <
  minStock`, con `compareDecimal` de `lib/decimal.ts`, Fase 11 — mismo
  umbral `<=` que ya usa `reportService.lowStock()`). Si se repone y
  vuelve a bajar después, es una transición nueva y notifica de nuevo,
  correctamente.
- **Sin permiso nuevo.** Igual que Reportes (Fase 11): son datos de
  lectura derivados de eventos que ya requieren permiso en su origen
  (crear movimiento, ver stock) — alcanza con `authenticate`. Marcar
  como leída es estado personal del usuario autenticado, no una acción
  que necesite `authorize()`.

## 3. Arquitectura

- Nuevo módulo `apps/api/src/modules/notifications/` (schemas,
  service, routes) — mismo patrón de capas que el resto (`products`,
  `categories`, `reports`).
- Sin worker/cron nuevo: las notificaciones se crean **sincrónicamente
  dentro de los flujos que ya existen** —
  `stockMovement.service.ts#createMovement()` para ambos disparadores
  (cruce de umbral tras un movimiento exitoso; rechazo cuando
  `source === "sync"`). No hay un tercer disparador que justifique un
  componente separado.
- Frontend: `apps/web/src/features/notifications/` — `api.ts`,
  `useNotifications.ts` (polling), `NotificationBell.tsx` (Radix
  `DropdownMenu`, ya usado en `UserMenu` — mismo primitivo, sin sumar
  dependencia). Se cuelga en el Topbar de `AppShell.tsx`, al lado de
  `SyncStatusBadge`.
- `pushOutbox()` (Fase 10) pasa `source: "sync"` en su llamada a
  `createMovement()` — único cambio en el motor de sync offline.

## 4. Diseño UI/UX

- Campanita en la Topbar (mismo lenguaje visual que `ThemeToggle`/
  `UserMenu` — ícono simple, sin texto). Badge numérico con el
  contador de no leídas (oculto en 0, tope visual "9+").
- Al hacer clic: dropdown con las últimas notificaciones (mensaje +
  tiempo relativo), cada una con un botón "Marcar como leída" que la
  atenúa in place (sin sacarla de la lista ni recargar) — mismo patrón
  de feedback inmediato que el resto de la app. Sin "marcar todas como
  leídas" en esta primera versión (no lo pidió el usuario; se anota
  como mejora posible en Revisión).
- Notificación de stock bajo enlaza a `/productos`; notificación de
  movimiento rechazado enlaza a `/movimientos`. Sin deep-link al
  producto puntual (abrir su drawer directo desde la URL) — Productos
  (Fase 7) no soporta hoy abrir un registro por query param, y agregar
  eso sería ampliar el alcance de esta fase para una mejora menor de
  navegación.
- Sin sonido ni notificaciones del navegador (`Notification` API) —
  fuera de alcance, ver Justificación técnica.

## 5. Modelo de datos

Nueva colección `notifications`:

| Campo | Tipo | Notas |
|---|---|---|
| `companyId` | ObjectId | scoped por tenant, igual que el resto |
| `type` | `"low_stock" \| "movement_rejected"` | closed union, no string libre |
| `message` | string | texto ya armado al crear (snapshot histórico — un producto puede cambiar de nombre después) |
| `productId` | ObjectId? | presente en ambos tipos, para el deep-link |
| `readBy` | ObjectId[] | userIds que la marcaron leída |
| `createdAt` | Date | `timestamps: true` |

Índice `{companyId, createdAt: -1}` para el listado paginado.

## 6. API

| Método y ruta | Query/Body | Respuesta | Permiso |
|---|---|---|---|
| `GET /notifications` | `?cursor&limit` | `{ items[], nextCursor }`, `read` calculado contra el usuario del token | autenticado |
| `GET /notifications/unread-count` | — | `{ count }` — endpoint liviano para el polling | autenticado |
| `POST /notifications/:id/read` | — | `204`, idempotente (`$addToSet`) | autenticado |

`POST /stock-movements` (Fase 9, existente) suma `source?: "sync"` al
body — no es un endpoint nuevo de notificaciones, es la señal que
necesita el disparador de "rechazado".

## 7. Seguridad

Todas las rutas exigen `authenticate`; todas las queries van scoped
por `companyId` del token, reforzado por `tenantScopePlugin`. Marcar
como leída solo agrega el propio `userId` del token a `readBy` — no
recibe un `userId` del body, así que un usuario no puede marcar
notificaciones como leídas en nombre de otro. Sin datos sensibles en
`message` (nombre de producto y cantidades, mismo nivel que ya es
visible en Productos/Movimientos para cualquier usuario autenticado
de la empresa).

## 8. Código

- **Backend:** `apps/api/src/db/models/notification.model.ts` (nuevo);
  `apps/api/src/modules/notifications/{notification.schemas.ts,
  notification.service.ts, notification.routes.ts}` (nuevo) — expone
  `createNotification()` como función standalone (no solo dentro del
  factory de servicio) para que otros módulos la llamen directo, mismo
  patrón que `resolveActiveBranch` (Fase 11). Registrado en `app.ts`.
  `stockMovement.service.ts` suma `notifyIfCrossedLowStock()` (llamada
  después de que la transacción confirma) y la notificación de rechazo
  en el catch de `insufficient_stock` cuando `body.source === "sync"`.
  `stockMovement.schemas.ts` suma `source?: "sync"` a
  `CreateMovementBodySchema`.
- **Frontend:** `apps/web/src/features/notifications/{api.ts,
  useNotifications.ts}` (nuevo, polling cada 45s + al recuperar el
  foco); `packages/ui/src/NotificationBell.tsx` (nuevo, campanita +
  dropdown de Radix, mismo primitivo que `UserMenu`, ícono SVG inline
  como `ThemeToggle` — sin sumar `lucide-react` a `packages/ui`).
  Wireado en `AppShell.tsx`. `syncEngine.ts#pushOutbox()` manda
  `source: "sync"`; `features/inventory/api.ts` suma el campo al tipo
  de input.
- `packages/shared-types`: `Notification`, `NotificationListResponse`,
  `UnreadNotificationCount`.

## 9. Testing y verificación

**9 tests nuevos** en `apps/api/test/notifications.test.ts` (usa
`MongoMemoryReplSet`, igual que `inventory.test.ts`, porque los
disparadores viven dentro de la transacción de `createMovement()`):
cruce de umbral genera notificación, no se repite mientras sigue bajo,
notifica de nuevo tras recuperarse y volver a cruzar, un rechazo sin
`source` no notifica, un rechazo con `source: "sync"` sí, lectura por
usuario (marcar leída no afecta a otro usuario de la misma empresa),
idempotencia de marcar como leída, aislamiento por tenant. **66 tests
de backend en total** (57 previos + 9 nuevos), todos en verde.
`lint`/`typecheck`/`build` de los 5 paquetes en verde.

## 10. Revisión

**Incidente real durante la verificación en navegador:** probando el
camino offline real (desconectar, encolar un movimiento que deja el
stock en negativo, reconectar), el usuario vio **3 notificaciones
duplicadas** para el mismo intento rechazado en vez de una. Causa: a
diferencia de un movimiento que sí se crea (protegido por
`clientMutationId`, Fase 9), un rechazo no persiste nada más, así que
si el motor de sync dispara el mismo `clientMutationId` más de una vez
casi al mismo tiempo (`StrictMode` de React duplica efectos en
desarrollo; en producción también podría pasar si una sync se dispara
mientras otra sigue en curso), cada intento fallido creaba su propia
notificación sin ningún control de idempotencia. **Fix:** `Notification`
suma `clientMutationId?` con el mismo patrón de índice único-y-opcional
que `Category.code` (`partialFilterExpression`, no `sparse` — ver
docs/08, adenda) y `createNotification()` absorbe el error de clave
duplicada en vez de propagarlo. Test nuevo que dispara el mismo
`clientMutationId` dos veces en paralelo y confirma que solo queda una
notificación. Se limpiaron a mano las 2 notificaciones duplicadas que
ya habían quedado en la base real (no las cubre el índice porque se
crearon antes del fix). **67 tests de backend en total** (66 previos +
1 nuevo), todos en verde. También se corrigió un detalle menor: el
mensaje envolvía el nombre del producto en comillas rectas, que
chocaban visualmente con nombres que ya las traen (ej. `4 1/2"`) — se
cambió a comillas angulares (`«»`).

**Terminado:** campanita con contador de no leídas, notificación de
stock bajo (con detección de cruce, sin repetir mientras sigue bajo),
notificación de movimiento rechazado al sincronizar offline
(distinguido del rechazo online vía `source: "sync"`, deduplicado por
`clientMutationId`), lectura por usuario, sin permiso nuevo. Verificado
en navegador por el usuario: cruce de umbral real vía movimientos,
marcar como leída, y el camino offline real (desconectar/reconectar).

**Falta:** aprobación final del usuario para cerrar la fase y
commitear — nada de esto está commiteado todavía.

**Podría mejorarse (no pedido, no implementado):** "marcar todas como
leídas"; deep-link directo al producto desde la notificación (Productos
no soporta hoy abrir un registro por query param).
