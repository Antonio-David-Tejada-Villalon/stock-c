# Fase 3 — Modelo de Datos (MongoDB)

Estado: **✅ aprobado** (2026-08-01). No se ha escrito código. Este
documento aplica en concreto las decisiones ya aprobadas en
[01-arquitectura.md](01-arquitectura.md): multiempresa por `companyId`
compartido, kardex como fuente de verdad (log de eventos append-only),
monolito modular.

Las 2 decisiones abiertas de este documento fueron confirmadas por el
usuario, ambas según la recomendación: (1) un usuario pertenece a una sola
empresa — sin membresías multiempresa por ahora, y (2) `stockLevels` se
mantiene sincronizado de forma transaccional con `stockMovements`.

---

## 1. Principios que rigen todo el modelo

1. **Todo documento de tenant lleva `companyId`.** Ningún documento de
   negocio existe sin él (excepto colecciones de plataforma, si las hay).
   Todo índice compuesto empieza por `companyId` — es al mismo tiempo una
   optimización de performance y el límite de seguridad definido en Fase 1.
2. **El kardex es la fuente de verdad del stock.** `stockMovements` es
   append-only: nunca se edita ni se borra un movimiento. El stock actual
   es una proyección, no un campo editable a mano.
3. **Concurrencia optimista en documentos mutables.** Todo documento que sí
   se edita (`products`, `categories`, `brands`, `units`, `companies`,
   `branches`, `roles`, `users`) lleva un campo `version` incremental. Un
   `update` sin la versión esperada es rechazado (409) — es el mecanismo
   que dispara la UI de "resolver conflicto" diseñada en Fase 2.
4. **Auditoría separada de negocio.** `auditLog` registra todo lo que muta,
   independientemente de si la colección de negocio ya lleva su propio
   rastro (como `stockMovements`).
5. **Sin `skip/limit` para listados grandes.** Paginación por cursor
   (`_id` u otro campo indexado) en productos y movimientos — con miles de
   SKUs y movimientos diarios, `skip` se degrada linealmente.

---

## 2. Diagrama de relaciones (texto)

```
Company (tenant)
 ├─ 1:N Branch
 ├─ 1:N Role            (roles propios + roles "sistema" reutilizables)
 ├─ 1:N User ──────────→ Role (referencia)
 ├─ 1:N Category ───┐    (self-ref parentId, subcategorías)
 ├─ 1:N Brand        │
 ├─ 1:N Unit          │
 ├─ 1:N Product ──────┴─→ Category, Brand, Unit (referencias)
 ├─ 1:N StockMovement ──→ Product, Branch, User (referencias)
 ├─ (derivado) StockLevel ──→ Company + Branch + Product (única)
 └─ 1:N AuditLog ───────→ User (referencia)
```

Todas las relaciones se resuelven por referencia (`ObjectId`), no por
documentos embebidos — necesario porque `products`, `stockMovements` y
`auditLog` crecen sin límite práctico y se consultan de formas distintas
entre sí (embeber los ataría a un único patrón de acceso).

---

## 3. Colecciones

### 3.1 `companies`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `name`, `slug` | string | `slug` único global, usado en subdominio/URL |
| `taxId` | string? | dato fiscal, opcional |
| `settings.timezone`, `settings.currency` | string | |
| `active` | bool | |
| `version` | int | concurrencia optimista |
| `createdAt`, `updatedAt` | date | |

Índices: `{ slug: 1 }` único.

### 3.2 `branches`

| Campo | Tipo |
|---|---|
| `_id`, `companyId` | ObjectId |
| `name`, `code` | string |
| `address` | string? |
| `active` | bool |
| `version`, `createdAt`, `updatedAt` | |

Índices: `{ companyId: 1, code: 1 }` único · `{ companyId: 1, active: 1 }`.

### 3.3 `roles`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `companyId` | ObjectId? | `null` = rol de sistema, disponible a todo tenant (Owner, Admin, Operador, Visor) |
| `name` | string | |
| `permissions` | string[] | ej. `"inventory:movement:create"`, `"product:update"` — strings libres, no enum fijo, para que módulos futuros registren permisos sin migrar el esquema |
| `isSystem` | bool | |
| `version`, `createdAt`, `updatedAt` | | |

Índices: `{ companyId: 1, name: 1 }`.

### 3.4 `users`

| Campo | Tipo | Notas |
|---|---|---|
| `_id`, `companyId` | ObjectId | ver 🔶 Decisión 1 sobre multi-empresa |
| `email` | string | único por `companyId` (no global — ver decisión 1) |
| `passwordHash` | string | argon2id |
| `name`, `avatarUrl` | string | |
| `roleId` | ObjectId | referencia a `roles` |
| `branchRestrictions` | ObjectId[] | vacío = acceso a todas las sucursales de la empresa |
| `active` | bool | |
| `lastLoginAt` | date? | |
| `version`, `createdAt`, `updatedAt` | | |

Índices: `{ companyId: 1, email: 1 }` único · `{ companyId: 1, active: 1 }`.

### 3.5 `sessions` (refresh tokens)

| Campo | Tipo |
|---|---|
| `_id`, `userId` | ObjectId |
| `tokenHash` | string |
| `deviceId` | string |
| `expiresAt` | date |
| `revokedAt` | date? |
| `createdAt` | date |

Índices: `{ tokenHash: 1 }` único · TTL index en `expiresAt` (limpieza
automática de sesiones vencidas). Redis mantiene una copia de lectura
rápida para revocación (definido en Fase 1); Mongo es el registro durable.

### 3.6 `categories`

| Campo | Tipo |
|---|---|
| `_id`, `companyId` | ObjectId |
| `name` | string |
| `parentId` | ObjectId? (self-ref, subcategoría) |
| `active` | bool |
| `version`, `createdAt`, `updatedAt` | |

Índices: `{ companyId: 1, parentId: 1 }` · `{ companyId: 1, name: 1 }`.

### 3.7 `brands` / 3.8 `units`

Mismo patrón que `categories` sin `parentId`: `companyId`, `name`,
(`abbreviation` en `units`), `active`, `version`, timestamps.

Índices: `{ companyId: 1, name: 1 }` único por colección.

### 3.9 `products`

| Campo | Tipo | Notas |
|---|---|---|
| `_id`, `companyId` | ObjectId | |
| `sku` | string | único por empresa |
| `name`, `description` | string | |
| `categoryId`, `brandId`, `unitId` | ObjectId | |
| `barcode` | string? | |
| `price`, `cost` | Decimal128 | **nunca `number`/float** — evita errores de redondeo en dinero |
| `images` | string[] | URLs a object storage |
| `active` | bool | |
| `version`, `createdAt`, `updatedAt`, `updatedBy` | | |

**No lleva un campo `stock`.** El stock es siempre una lectura desde
`stockLevels`, nunca un valor editable directo en el producto — consistente
con la decisión de kardex-como-fuente-de-verdad de Fase 1. *(Asunción: el
precio es global por empresa, no varía por sucursal — nada en los
requisitos pidió precio por sucursal; se puede revisar si hace falta.)*

Índices: `{ companyId: 1, sku: 1 }` único · `{ companyId: 1, categoryId: 1 }`
· `{ companyId: 1, active: 1, name: 1 }` (listado por defecto) · índice de
texto `{ name: "text", sku: "text", barcode: "text" }` para búsqueda.

### 3.10 `stockMovements` (kardex — append-only, fuente de verdad)

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | asignado por el servidor |
| `companyId`, `branchId`, `productId` | ObjectId | |
| `type` | enum | `entrada` / `salida` / `ajuste` / `transferencia` |
| `quantity` | Decimal128 | siempre positivo; el signo lo da `type` |
| `sequence` | long | **autoritativo, asignado por el servidor**, monotónico por `companyId+branchId+productId` — es lo que ordena el kardex sin ambigüedad, incluso si dos movimientos offline llegan casi al mismo tiempo |
| `reason`, `reference` | string? | motivo, nº de remito/orden |
| `clientMutationId` | UUID | generado por el cliente **offline**, es la clave de idempotencia |
| `createdBy` | ObjectId (User) | |
| `clientCreatedAt` | date | hora del dispositivo (puede diferir del servidor) |
| `createdAt` | date | hora del servidor, autoritativa |

Índices: `{ companyId: 1, clientMutationId: 1 }` único → si el cliente
reenvía el mismo movimiento tras reconectar (outbox no confirmado), el
servidor lo ignora en vez de duplicarlo. `{ companyId: 1, branchId: 1,
productId: 1, sequence: 1 }` → lectura del kardex de un producto en orden.
`{ companyId: 1, branchId: 1, createdAt: -1 }` → feed de "movimientos
recientes" del dashboard.

Correcciones nunca editan un movimiento existente: se registra un nuevo
movimiento `ajuste` que compensa el error, preservando el historial
completo — es la práctica contable correcta para un kardex, además de ser
lo que hace posible la sincronización offline sin conflictos reales (ver
Fase 1, sección 6).

### 3.11 `stockLevels` (caché materializado — NO es fuente de verdad)

| Campo | Tipo |
|---|---|
| `_id` | ObjectId |
| `companyId`, `branchId`, `productId` | ObjectId |
| `quantity` | Decimal128 |
| `lastSequence` | long | último `sequence` de `stockMovements` reflejado aquí |
| `updatedAt` | date |

Índices: `{ companyId: 1, branchId: 1, productId: 1 }` único.

Existe únicamente para no sumar miles de movimientos cada vez que el
dashboard pide "stock actual" — es 100% reconstruible desde
`stockMovements` en cualquier momento (`quantity = Σ movements` hasta
`lastSequence`). Ver 🔶 Decisión 2 sobre cómo se mantiene sincronizado.

### 3.12 `auditLog` (append-only)

| Campo | Tipo |
|---|---|
| `_id`, `companyId` | ObjectId |
| `userId` | ObjectId |
| `action` | string, ej. `"product.update"`, `"user.role_change"` |
| `entity`, `entityId` | string, ObjectId |
| `changes` | objeto `{ campo: { from, to } }` — diff, no snapshot completo (más liviano en storage que guardar el documento entero antes/después) |
| `ip`, `userAgent` | string? |
| `createdAt` | date |

Índices: `{ companyId: 1, entity: 1, entityId: 1, createdAt: -1 }` (historial
de un registro) · `{ companyId: 1, userId: 1, createdAt: -1 }` (actividad
de un usuario).

---

## 4. Validación de esquema

Cada colección lleva un validador `$jsonSchema` a nivel de MongoDB (no solo
validación en la capa de aplicación) como defensa en profundidad: tipos
`bsonType` correctos (`Decimal128` para dinero, no `double`), `enum` para
campos como `type` en `stockMovements`, y `required` en los campos
obligatorios de la tabla de cada colección. El detalle exacto de cada
esquema se implementa como código en Fase 4/9, no aquí.

## 5. Versionado (concurrencia optimista)

Todo `update` a un documento mutable debe incluir la `version` que el
cliente tenía al leerlo. El servidor ejecuta
`updateOne({ _id, version: v }, { $set: {...}, $inc: { version: 1 } })`; si
no matchea ningún documento, responde `409 Conflict` — el cliente ofrecido
en Fase 2 (UI de resolución manual) toma esa respuesta y muestra ambas
versiones al usuario.

## 6. Auditoría

Dos capas, con propósitos distintos:
- `stockMovements` **es** la auditoría de cantidades — completa, ordenada,
  inmutable.
- `auditLog` cubre todo lo demás que muta (productos, categorías, roles,
  usuarios, sucursales) con diffs de campo, no snapshots completos.

---

## ✅ Decisión 1 (confirmada) — Un usuario pertenece a una sola empresa

Hoy el modelo pone `companyId` fijo en `users` (un usuario = una empresa).
Es el diseño más simple y es coherente con el aislamiento por `tenantId`
de Fase 1.

- **Recomendación: mantenerlo así por ahora** (un usuario = una empresa).
  Si una misma persona opera dos negocios distintos, se crea una cuenta
  por empresa (mismo email es válido en ambas porque el índice único de
  `email` es *por* `companyId`, no global). Es la opción de menor
  complejidad y cubre el caso principal descrito (una ferretería con sus
  sucursales).
- **Alternativa:** modelo de membresías (`userMemberships: { userId,
  companyId, roleId }`), donde un login puede "cambiar de empresa" sin
  cerrar sesión — útil para un contador o dueño de varios negocios
  distintos (no sucursales, empresas separadas).
  - Ventaja: mejor UX para ese caso de uso específico.
  - Desventaja: agrega una capa de indirección a *todo* el sistema de
    permisos desde el día 1, para un caso de uso que hoy no está
    confirmado como necesario.
- Si más adelante hace falta, migrar de "un usuario = una empresa" a
  membresías es un cambio acotado (una colección nueva + ajustar el
  middleware de auth), no una reescritura.

## ✅ Decisión 2 (confirmada) — Sincronización transaccional de `stockLevels`

- **Opción A — Transaccional (recomendada):** insertar el `stockMovement` y
  hacer `upsert` del `stockLevel` correspondiente dentro de una única
  transacción multi-documento de MongoDB (el replica set ya decidido en
  Fase 1 lo soporta). El stock mostrado en pantalla nunca está
  desactualizado ni por un instante.
  - Desventaja: las transacciones multi-documento en MongoDB tienen más
    costo que un `insert` suelto — aceptable al volumen de "miles de
    usuarios", a revisar si el volumen de movimientos por segundo se
    vuelve extremo.
- **Opción B — Reconciliación asíncrona:** el movimiento se inserta solo;
  un worker en cola (BullMQ, ya definido en Fase 1) recalcula
  `stockLevels` poco después.
  - Ventaja: escritura de movimientos más rápida y barata.
  - Desventaja: hay una ventana (milisegundos a segundos) donde el stock
    mostrado puede estar desactualizado — arriesgado si dos operadores
    miran el mismo producto casi al mismo tiempo y ambos ven stock
    disponible que ya no está.
- **Recomendación: Opción A** — para inventario, mostrar un número
  incorrecto aunque sea por un segundo es peor que el costo extra de la
  transacción. Se puede revisar en Fase 14 (Optimización) si el perfil de
  carga real lo justifica.

---

## Resumen — qué cubre este documento

- 12 colecciones definidas con campos, tipos, índices y relaciones.
- Estrategia de versionado (concurrencia optimista) y auditoría en dos
  capas.
- Confirmación de que el stock nunca es un campo editable directo, sino
  proyección del kardex — la decisión más importante de Fase 1 aplicada
  aquí en concreto.

## Qué falta / se resuelve en fases posteriores

- Esquemas `$jsonSchema` exactos como código → Fase 4/9.
- Colecciones de módulos futuros (ventas, compras, POS, etc.) no se
  diseñan hasta que se aprueben esos módulos.
- Estrategia de sharding (si algún día hace falta) — el diseño actual ya
  deja `companyId` como primer campo de todo índice compuesto, que es el
  shard key natural si se necesita más adelante; no se activa ahora.

## Qué podría mejorarse

- Nada bloqueante. Las dos decisiones abiertas arriba son las únicas que
  podrían cambiar la forma de colecciones ya definidas si se elige la
  alternativa en vez de la recomendación.
