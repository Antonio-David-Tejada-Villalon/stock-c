# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

## Estado actual (última actualización: 2026-08-05)

**Fase en curso: 10 — Offline First (recorte inicial: Productos +
Movimientos), código completo, pendiente de verificación en navegador y
aprobación del usuario.** Fases 1-9 aprobadas.

**Adenda de branding (2026-08-05, sobre Fase 2 — detalle completo en
[docs/02-diseno-ui-ux.md](docs/02-diseno-ui-ux.md), sección "Adenda —
Refresh de marca"):** el usuario proveyó `stockc_brand_guidelines.webp` y
pidió aplicarla. `--accent` pasa de índigo a **Electric Blue** (`#2663EB`/
`#5B8DF5`) — el Naranja de marca (`#FF6B00`) no puede ser el acento único
porque texto blanco sobre él falla WCAG AA (~2.86:1); el naranja queda
como `--brand-mark`, exclusivo del isotipo/app icon, nunca en botones o
texto. `--success`/`--warning`/`--danger` sin cambios (son "un sistema
aparte" según la Fase 2 original). Tipografía nativa del SO reemplazada
por **Manrope + Inter autohospedadas** (`@fontsource`, sin CDN — respeta
offline-first de Fase 10), confirmado explícitamente por el usuario antes
de tocar esa decisión ya aprobada. Isotipo hexagonal nuevo
(`packages/ui/src/Logo.tsx`, recreado en SVG — no había vector original)
en el sidebar y como favicon; manifest de PWA actualizado con colores de
marca. No se generaron íconos PNG multi-resolución (instalabilidad PWA
sigue fuera de alcance) ni se retocó cada heading de cada pantalla
individualmente (`font-heading` queda disponible para aplicarse
screen-by-screen si se pide). Pendiente: verificación visual del usuario.

**Fase 10 (Offline First, recorte inicial) — resumen** (detalle completo
en [docs/10-offline-first.md](docs/10-offline-first.md)): sobre la
arquitectura de sync híbrida ya decidida en Fase 1 (log de eventos para
stock + LWW para datos maestros), **recorte explícito del usuario**:
Productos queda **solo lectura offline** (catálogo + stock cacheados en
IndexedDB vía Dexie); Movimientos queda **con alta en cola offline**
(*outbox* — siempre se escribe ahí primero, esté online o no, en vez de
tener dos caminos de código distintos). Categorías/Marcas/Unidades y el
Panel siguen sin caché offline (decisión explícita). **UI de conflictos
LWW diseñada pero no construida** (simple: descartar o sobrescribir,
decisión explícita del usuario) — este recorte no tiene ninguna edición
offline de datos maestros que la dispare, queda lista para cuando se
extienda el alcance. La falla real de este recorte (un movimiento
encolado offline que el servidor rechaza al sincronizar, ej.
`insufficient_stock`) cae en una sección "Con error" en `/movimientos`
con Reintentar/Descartar — nunca se descarta en silencio. `GET /products`
suma un modo delta (`?updatedSince=`) reutilizando la ruta existente, sin
módulo de sync nuevo. Service Worker vía `vite-plugin-pwa`, solo
precachea el shell de la app — a propósito sin cachear respuestas de la
API (ese es trabajo de Dexie, no del SW). Primera vez que `apps/web`
tiene test runner (Vitest + `fake-indexeddb`) — 5 tests nuevos del motor
de sync. 46 tests de backend en verde (44 previos + 2 del modo delta).
**Código commiteado junto con la adenda de branding — sigue pendiente la
verificación en navegador y aprobación del usuario para marcar la fase
como aprobada.**

**Fase 9 (Control de inventario) — resumen breve** (detalle completo en
[docs/09-control-inventario.md](docs/09-control-inventario.md)): registro
de movimientos (entrada/salida/ajuste) con kardex, sucursal única
implícita, stock negativo bloqueado, `sequence` atómico dentro de una
transacción de Mongo (primera fase con transacciones reales,
`MongoMemoryReplSet` en los tests), `clientMutationId` para idempotencia
(la base que usa la Fase 10). Adenda el mismo día: se conectó el Panel y
el buscador de la barra superior a datos reales (tenían placeholders de
fases ya completadas). Verificada en navegador y commiteada (`a013b7f`).

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
con la suya (commit `a013b7f`) no se verificó por falta de `gh` CLI en
esta sesión — revisar manualmente en GitHub Actions si hace falta
confirmar. Fase 10 todavía no está commiteada.

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
- Offline First (Fase 10): recorte inicial a Productos (solo lectura) +
  Movimientos (alta en cola vía outbox, siempre, online u offline);
  Categorías/Marcas/Unidades y Panel sin offline todavía; UI de
  conflictos LWW diseñada (descartar o sobrescribir, sin editor por
  campo) pero no construida — este recorte no la dispara.

**Próximo paso inmediato:** verificación en navegador y aprobación del
usuario para cerrar la Fase 10 (código completo, sin commitear) — con
las DevTools en modo offline: navegar Productos con el caché, registrar
un movimiento, reconectar y confirmar que sincroniza solo, y forzar un
rechazo para ver la sección "Con error". Después de aprobada, sigue la
**Fase 11 — Reportes**.

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
