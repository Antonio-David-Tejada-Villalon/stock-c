# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

## Estado actual (última actualización: 2026-08-05)

**Fase en curso: 9 — Control de inventario (entradas, salidas, kardex),
aún no arrancada.** Fases 1-8 aprobadas.

**Fase 8 (Categorías, marcas, unidades) — resumen** (detalle completo en
[docs/08-categorias-marcas-unidades.md](docs/08-categorias-marcas-unidades.md)):
CRUD de las tres tablas maestras que Fase 7 dejó pendientes. **Categorías
en árbol sin límite de profundidad** (decisión explícita del usuario, no
solo un nivel) con **validación de ciclos en el servidor** (no se puede
asignar como padre a un descendiente propio). Desactivar una categoría/
marca/unidad **no se bloquea** aunque haya productos activos que la
referencien (mismo criterio de soft-delete que productos, decisión
explícita del usuario). Marcas y Unidades comparten un factory genérico
de servicio/rutas (`modules/catalogs/simpleCatalog.*`) para no duplicar
CRUD idéntico dos veces; Categorías tiene su propio módulo por la lógica
de jerarquía. 9 permisos nuevos (`category|brand|unit:create/update/
delete`) — heredados automáticamente por Owner/Admin vía
`Object.values(PERMISSIONS)` en el seed, sin tocarlo. `packages/ui` suma
`Tabs` (Radix) y `Select`. 32 tests de backend en verde (21 previos + 11
Fase 8). Seed de desarrollo extendido con categorías/marcas/unidades/
productos de ejemplo (sabor San Juan/Cuyo, marcas ficticias) para probar
con datos reales en vez de una base vacía.

**Fase 8 commiteada y pusheada a `main`** (commit `8088447`).

**Adenda post-Fase 8 (mismo día):** se agregaron los selectores de
categoría/marca/unidad al formulario de productos (Fase 7) — pendiente
que había quedado abierto al cerrar Fase 8. `CreateProductBodySchema`/
`UpdateProductBodySchema` aceptan `categoryId`/`brandId`/`unitId`
opcionales (`null` en el update para quitar la referencia);
`ProductFormDrawer.tsx` los renderiza con el `Select` de Fase 8. De paso
se encontró y corrigió un bug de AJV: con `coerceTypes` (default de
Fastify), un `Union([String, Null])` con `String` primero coacciona un
`null` entrante a `""` antes de intentar la rama `Null`, y Mongoose
revienta al castear `""` como `ObjectId` — fix fue reordenar a
`Union([Null, String])` en `product.schemas.ts` **y**
`category.schemas.ts` (Fase 8 tenía el mismo bug latente, sin test que lo
cubriera). 33 tests de backend en verde en total. Código completo y
verificado (`lint`/`typecheck`/`build`/`test`), **todavía no commiteado**.

**Incidente real durante la verificación de esta fase** (infraestructura,
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
CI de Fase 8 (commit `8088447`) no se verificó por falta de `gh` CLI en
esta sesión — revisar manualmente en GitHub Actions si hace falta
confirmar.

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

**Próximo paso:** Fase 9 — Control de inventario (entradas, salidas,
kardex), sobre el modelo ya definido en
[docs/03-modelo-datos.md](docs/03-modelo-datos.md) (`stockMovements`
append-only como fuente de verdad, `stockLevels` como caché
materializado, sincronización transaccional decidida en Fase 3).

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
| 9 | Control de inventario (entradas, salidas, kardex) | ⚪ pendiente |
| 10 | Offline First (IndexedDB/Dexie, Service Workers, sync) | ⚪ pendiente |
| 11 | Reportes | ⚪ pendiente |
| 12 | Notificaciones | ⚪ pendiente |
| 13 | Configuración general | ⚪ pendiente |
| 14 | Optimización | ⚪ pendiente |
| 15 | Deploy | ⚪ pendiente |

Documentos de cada fase se guardan en `docs/NN-nombre-fase.md`.
