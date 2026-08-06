# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

## Estado actual (última actualización: 2026-08-06)

Fases 1-11 aprobadas. Próxima fase por definir (Fase 12 — Notificaciones,
o la adenda de Categorías anotada más abajo, según lo que el usuario
prefiera empezar).

**Fase 11 (Reportes) — resumen** (detalle completo en
[docs/11-reportes.md](docs/11-reportes.md)): alcance confirmado con el
usuario, los 4 reportes con exportación a CSV — **Valorización de
inventario** (stock × costo por producto/categoría/marca, excluye
activos sin costo cargado), **Movimientos por rango de fechas**
(agregado de todos los productos, filtrable por tipo/fecha/categoría,
tope de 5000 resultados), **Resumen por categoría/marca** (activos/
inactivos, distribución de stock) y **Stock bajo** (nuevo campo
`Product.minStock`, opcional — sin cargarlo, el producto no participa,
nunca se asume 0). Los 4 servicios usan `.find({ companyId, ... })` +
agrupación en memoria, nunca `.aggregate()` — `tenantScopePlugin` (el
cinturón de seguridad multiempresa) no cubre el pipeline de agregación
de Mongoose, así que usar `.find()` mantiene la protección existente en
vez de duplicarla a mano. Nueva librería `lib/decimal.ts` (bigint de
punto fijo, 4 decimales) para sumar/multiplicar costos y cantidades sin
arrastre de error de punto flotante. `resolveActiveBranch` se extrajo a
un helper compartido (`db/helpers/`) porque Fase 11 lo necesitaba en los
4 servicios, no solo en Inventario. CSV se genera en el cliente sobre
los datos ya cargados en pantalla (sin ruta de API nueva por reporte).
Sin permiso nuevo — mismo criterio que el resto de los `GET` de lectura
del sistema. 54 tests de backend en verde (46 previos + 8 nuevos).
También se conectó la tarjeta "Stock bajo" del Panel (placeholder desde
la adenda de Fase 9) a `DashboardSummary.lowStockCount`, reutilizando
`reportService.lowStock()`. Verificada en navegador y aprobada por el
usuario; commiteada (`eb81add`).

**Fase 10 (Offline First, recorte inicial) — resumen** (detalle completo
en [docs/10-offline-first.md](docs/10-offline-first.md)): sobre la
arquitectura de sync híbrida ya decidida en Fase 1 (log de eventos para
stock + LWW para datos maestros), recorte explícito del usuario:
Productos solo lectura offline (Dexie); Movimientos con alta en cola
offline (*outbox*, siempre, online u offline, reutiliza
`clientMutationId` de Fase 9 para idempotencia). Un movimiento rechazado
al sincronizar (ej. `insufficient_stock`) cae en "Con error" en
`/movimientos` con Reintentar/Descartar — nunca en silencio. `GET
/products` suma modo delta (`?updatedSince=`). Service Worker
(`vite-plugin-pwa`) precachea solo el shell de la app. Primera vez que
`apps/web` tiene test runner (Vitest + `fake-indexeddb`). Verificada en
navegador y aprobada por el usuario; commiteada (`d9edaba`).

**Adenda de branding (2026-08-05, sobre Fase 2)** (detalle completo en
[docs/02-diseno-ui-ux.md](docs/02-diseno-ui-ux.md), sección "Adenda —
Refresh de marca"): aplicó `stockc_brand_guidelines.webp` (archivada en
[docs/assets/stockc-brand-guidelines.webp](docs/assets/stockc-brand-guidelines.webp)).
`--accent` pasa de índigo a **Electric Blue** (`#2663EB`/`#5B8DF5`) — el
Naranja de marca (`#FF6B00`) no puede ser el acento único porque texto
blanco sobre él falla WCAG AA (~2.86:1); el naranja queda como
`--brand-mark`, exclusivo del isotipo/app icon. Tipografía nativa del SO
reemplazada por **Manrope + Inter autohospedadas**. Isotipo hexagonal
nuevo (`packages/ui/src/Logo.tsx`) en sidebar y favicon. **Toggle de
tema claro/oscuro** implementado (diseño ya especificado en Fase 2 §6,
nunca construido) — `localStorage` gana sobre el sistema, sin elección
sigue `prefers-color-scheme` en vivo, anti-flash en `index.html`, botón
sol/luna en la topbar. No se generaron íconos PNG multi-resolución
(instalabilidad PWA sigue fuera de alcance) ni se retocó cada heading
individualmente. Verificada en navegador y aprobada por el usuario;
commiteada (`d9edaba` + `41c7cea`).

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
- Branding (adenda sobre Fase 2): `--accent` = Electric Blue (único,
  marca+interacción); Naranja de marca solo en el isotipo
  (`--brand-mark`); Manrope+Inter autohospedadas; toggle de tema
  claro/oscuro implementado.
- Reportes (Fase 11): 4 reportes (valorización, movimientos por rango,
  resumen por categoría/marca, stock bajo) con CSV; `Product.minStock`
  opcional nuevo; `.find()` + agrupación en memoria en vez de
  `.aggregate()` (`tenantScopePlugin` no cubre agregación); sin permiso
  nuevo.

**Pendiente anotado para después de Fase 11 (adenda sobre Fase 8, NO
iniciada — decisión del usuario de posponerla, 2026-08-06):** ampliar
Categorías con `código`, `ícono`, `color`, `imagen` y `orden` manual
(hoy se listan alfabético) — campos concretos, **no** un sistema
genérico de atributos dinámicos/EAV (el usuario eligió explícitamente
esa opción; mismo criterio que ya usó Fase 8 al rechazar generalizar el
formulario de Marca/Unidad). El árbol sin límite de profundidad de
Fase 8 ya cubre jerarquías tipo Categoría/Subcategoría/Familia/Línea sin
cambios — no hace falta (ni conviene) un campo "Nivel" fijo.

**Próximo paso inmediato:** elegir entre la **Fase 12 — Notificaciones**
o la adenda de Categorías anotada arriba (código/ícono/color/imagen/
orden). Fase 11 ya está aprobada y commiteada.

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
| 10 | Offline First (IndexedDB/Dexie, Service Workers, sync) | ✅ aprobada |
| 11 | Reportes | ✅ aprobada |
| 12 | Notificaciones | ⚪ pendiente |
| 13 | Configuración general | ⚪ pendiente |
| 14 | Optimización | ⚪ pendiente |
| 15 | Deploy | ⚪ pendiente |

Documentos de cada fase se guardan en `docs/NN-nombre-fase.md`.
