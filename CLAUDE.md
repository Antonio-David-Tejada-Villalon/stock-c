# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

## Estado actual (última actualización: 2026-08-05)

**Fase en curso: 10 — Offline First, aún no arrancada.** Fases 1-9
aprobadas.

**Fase 9 (Control de inventario) — resumen** (detalle completo en
[docs/09-control-inventario.md](docs/09-control-inventario.md)): registro
de movimientos de stock (**entrada, salida, ajuste** — decisión explícita
del usuario, sin `transferencia` todavía) con **kardex** por producto.
**Sucursal única implícita** (decisión explícita del usuario): no hay
CRUD de sucursales ni selector en la UI todavía — el backend resuelve
la única sucursal activa de la empresa y falla ruidosamente
(`500 no_active_branch`) si hay 0 o más de 1. **Stock negativo bloqueado**
(decisión explícita del usuario): una salida/ajuste que dejaría stock
negativo se rechaza con `400 insufficient_stock`. `sequence` del kardex
reutiliza `stockLevels.lastSequence` como contador atómico, asignado
dentro de una **transacción multi-documento de Mongo** (ya decidida en
Fase 3) junto con el `$inc` de `stockLevel` — primera fase con
transacciones reales, por lo que los tests usan `MongoMemoryReplSet` en
vez del `MongoMemoryServer` standalone de fases anteriores. `ajuste` es
el único tipo cuyo `quantity` puede ser negativo (aclaración necesaria al
modelo de Fase 3, que no especificaba el signo de `ajuste`).
`clientMutationId` (UUID generado en el cliente) ya deja funcionando la
idempotencia que Fase 3 diseñó pensando en Fase 10 (Offline First): un
reintento con el mismo id no duplica el movimiento. **Verificado en
navegador por el usuario** contra la base real de Atlas: entrada 20 →
salida 5 → ajuste -2 con motivo dejó el stock en 13 (coincide
exactamente), kardex y columna de stock reflejaron cada paso, y una
salida de 999 fue rechazada por `insufficient_stock` sin tocar el stock.

**Adenda post-Fase 9 (mismo día):** al verificar en el navegador se
encontraron dos textos desactualizados que quedaron colgados desde fases
anteriores — el Panel (Fase 6) seguía mostrando "Productos activos" y
"Movimientos hoy" como "Se activa en la Fase 7/9" aunque esas fases ya
estaban hechas, y la barra superior tenía un buscador muerto que decía
"Buscar producto… (Fase 7)". Se conectó `GET /dashboard/summary` a datos
reales (`productCount`, `movementsTodayCount`, `recentMovements`, con el
mismo criterio de sucursal única implícita pero sin fallar si es
ambigua — el Panel no es una operación de inventario) y el buscador pasó
a ser un link real a `/productos`. "Stock bajo" queda con un motivo
honesto (falta diseñar un umbral de stock mínimo por producto) en vez de
un placeholder de fase vencida. 44 tests de backend en verde (33 previos
+ 10 Fase 9 + 1 de esta adenda).

**Fase 9 y su adenda commiteadas y pusheadas a `main`** (commit
`a013b7f`).

**Fase 8 (Categorías, marcas, unidades) — resumen breve** (detalle
completo en
[docs/08-categorias-marcas-unidades.md](docs/08-categorias-marcas-unidades.md)):
CRUD de las tres tablas maestras que Fase 7 dejó pendientes, categorías
en árbol sin límite de profundidad con validación de ciclos en el
servidor, factory genérico para Marcas/Unidades
(`modules/catalogs/simpleCatalog.*`). Commiteada (`8088447`) junto con
una adenda el mismo día que agregó los selectores de categoría/marca/
unidad al formulario de productos y corrigió un bug de AJV (coerción
`null`→`""` en `Union([String, Null])`, fix: reordenar a `Union([Null,
String])`) — commit `605e54d`. Detalle completo en el bullet de
"decisiones confirmadas" más abajo.

**Incidente real durante la verificación de Fase 7** (infraestructura,
no código): al levantar el API para probar en navegador, `mongoPlugin` no
conectaba a Atlas — TCP abría pero el handshake TLS se cortaba con
`SSL alert: internal error` en los tres nodos del cluster. Se descartó
whitelist de IP (confirmada activa), cambio de red y antivirus con
inspección SSL; se resolvió solo después de un rato, consistente con
mantenimiento/propagación transitoria del lado de Atlas. Si vuelve a
pasar: el error genérico de Fastify (`AVV_ERR_PLUGIN_EXEC_TIMEOUT`) no
dice la causa real — conectar aparte con `serverSelectionTimeoutMS` alto
para ver el error de TLS/red real.

**Cuentas reales ya creadas** (adelantando parte de Fase 4/15): **MongoDB
Atlas** (cluster `Cluster0`, Network Access con `0.0.0.0/0` para no
depender de IP fija en desarrollo) y **Upstash Redis** (base
`stock-c-dev`, Oregon). Credenciales en `apps/api/.env`, gitignored,
nunca se subieron a GitHub. Faltan **Vercel** y **Render**.

**Fase 7 commiteada y pusheada a `main`** (commit `a3c2ce1`), CI en
verde (`pnpm install/lint/typecheck/build/test`) —
[run 30980196759](https://github.com/Antonio-David-Tejada-Villalon/stock-c/actions/runs/30980196759).
CI de Fase 8 (commit `8088447`), su adenda (commit `605e54d`) y Fase 9
con la suya no se verificó por falta de `gh` CLI en esta sesión —
revisar manualmente en GitHub Actions si hace falta confirmar.

**Stack y decisiones ya confirmadas por el usuario** (no volver a
preguntar, solo verificar que sigan vigentes si algo no cuadra):
- Arquitectura (Fase 1): monolito modular, Fastify, multiempresa por
  `companyId` compartido (no DB-per-tenant), sincronización offline
  híbrida (log de eventos para stock + LWW para datos maestros), modelo de
  costo "gratis para desarrollar, pagar solo si crece".
- Modelo de datos (Fase 3): un usuario = una empresa (sin membresías
  multiempresa), `stockLevels` sincronizado transaccionalmente con
  `stockMovements`.
- Despliegue (decidido en Fase 4, actualiza lo dejado abierto en Fase 1):
  **GitHub → Vercel** (`apps/web`) **+ Render** (`apps/api`) **+ MongoDB
  Atlas** (base de datos) **+ Upstash** (Redis). Todo con tier gratuito
  para empezar. **Atlas y Upstash ya tienen cuenta real creada** (cluster
  `Cluster0` / base `stock-c-dev`, credenciales en `apps/api/.env`
  gitignored) — faltan Vercel y Render.
- Autenticación (Fase 5): access token JWT 15min + refresh opaco rotativo
  en cookie httpOnly `SameSite=None` (necesario porque Vercel/Render son
  dominios distintos) + CSRF mitigado con header custom en vez de un
  esquema completo de doble submit (justificación en docs/05, sección 3).
  React Router elegido para el enrutamiento (no se había decidido antes).
- Monorepo pnpm + Turborepo scaffoldeado y verificado (`pnpm install` /
  `lint` / `typecheck` / `build` / `test` en verde). Detalle completo en
  [docs/04-configuracion-proyecto.md](docs/04-configuracion-proyecto.md).
- Sistema de diseño (Fase 6): Tailwind CSS v4 + Radix UI +
  class-variance-authority en `packages/ui`, tokens de Fase 2 como
  variables CSS en `packages/ui/tokens.css`. Componentes se agregan solo
  cuando una pantalla real los necesita, no todo el catálogo de una.
- Productos (Fase 7): `categoryId`/`brandId`/`unitId` son opcionales en el
  modelo (no obligatorios como decía Fase 3 originalmente); desde la
  adenda post-Fase 8 el formulario ya los selecciona.
- Categorías/marcas/unidades (Fase 8): categorías en árbol sin límite de
  profundidad con validación de ciclos en el servidor; desactivar no se
  bloquea por referencias activas (mismo criterio que productos).
- Control de inventario (Fase 9): sucursal única implícita (sin CRUD de
  sucursales todavía); tipos de movimiento entrada/salida/ajuste (sin
  transferencia); stock negativo bloqueado; `ajuste` es el único tipo con
  `quantity` con signo.

**Próximo paso:** Fase 10 — Offline First (IndexedDB/Dexie, Service
Workers, sincronización), sobre lo ya diseñado en
[docs/01-arquitectura.md](docs/01-arquitectura.md) (sync híbrida: log de
eventos para stock, LWW para datos maestros) y aprovechando que
`clientMutationId` (Fase 9) ya deja la idempotencia del lado del servidor
lista para reintentos offline.

## Modo de trabajo (obligatorio, no negociable)

Este proyecto se construye **por fases**, nunca completo de una vez. El prompt
maestro original vive en [docs/00-prompt-maestro.md](docs/00-prompt-maestro.md).

Reglas duras:

1. **Nunca avanzar de fase sin aprobación explícita del usuario.** Al terminar
   cada fase: resumir qué quedó terminado, qué falta, qué podría mejorarse, y
   preguntar si desea continuar / modificar / mejorar / agregar / cambiar
   arquitectura.
2. **Nunca dos fases en simultáneo.**
3. **Nunca agregar funcionalidades "porque sí"** (QR, facturación, CRM, POS,
   app móvil, reportes, dashboards extra, etc.). Proponer y esperar
   aprobación.
4. **Actuar como arquitecto principal, no como generador de código.** Si una
   decisión de diseño, arquitectura, seguridad, rendimiento o UX puede
   comprometer la escalabilidad futura: detener esa fase, explicar el
   problema, proponer al menos dos alternativas con pros/contras, y esperar
   decisión del usuario. Nunca sacrificar calidad arquitectónica por avanzar
   rápido.
5. **Orden de entregables dentro de cada fase con código:** Objetivo →
   Justificación técnica → Arquitectura → Diseño UI/UX → Modelo de datos →
   API → Seguridad → Código → Testing → Revisión. El código va casi al final,
   nunca al principio.
6. Código siempre limpio, documentado donde el porqué no sea obvio, separado
   en archivos pequeños — nunca archivos gigantes.

## Objetivo del producto

Plataforma de gestión de inventario en MERN, modular, escalable, **offline
first**, **multiempresa**, **multisucursal**, preparada para miles de
usuarios, con excelente UI/UX y pensada para crecer hacia un ERP completo
(ventas, compras, producción, CRM, POS, facturación electrónica, RRHH,
contabilidad, app móvil, marketplace, API pública, integraciones) — pero
ninguno de esos módulos se desarrolla hasta indicación explícita.

## Dirección de diseño UI/UX

Inspiración: Linear, Notion, Stripe Dashboard, Vercel Dashboard, GitHub,
Raycast, Arc Browser, Supabase, Clerk, Figma. Nada de Bootstrap genérico.
Minimalista, espaciado amplio, jerarquía visual clara, modo claro/oscuro,
responsive, animaciones 150–250ms, skeleton loaders, empty states,
accesibilidad WCAG 2.2 AA.

## Mapa de fases

| # | Fase | Estado |
|---|------|--------|
| 1 | Arquitectura completa del proyecto | ✅ aprobada |
| 2 | Diseño UI/UX completo (sistema de diseño, sin código) | ✅ aprobada |
| 3 | Modelo de datos MongoDB (sin código) | ✅ aprobada |
| 4 | Configuración del proyecto (repo, carpetas, linting, Docker, envs) | ✅ aprobada |
| 5 | Autenticación (JWT, refresh, roles, permisos, sesiones) | ✅ aprobada |
| 6 | Dashboard principal | ✅ aprobada |
| 7 | CRUD de productos | ✅ aprobada |
| 8 | Categorías, marcas, unidades | ✅ aprobada |
| 9 | Control de inventario (entradas, salidas, kardex) | ✅ aprobada |
| 10 | Offline First (IndexedDB/Dexie, Service Workers, sync) | ⚪ pendiente |
| 11 | Reportes | ⚪ pendiente |
| 12 | Notificaciones | ⚪ pendiente |
| 13 | Configuración general | ⚪ pendiente |
| 14 | Optimización | ⚪ pendiente |
| 15 | Deploy | ⚪ pendiente |

Documentos de cada fase se guardan en `docs/NN-nombre-fase.md`.
