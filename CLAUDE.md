# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

## Estado actual (última actualización: 2026-08-02)

**Fase en curso: 7 — CRUD de productos, aún no arrancada.** Fases 1-6
aprobadas.

**Fase 6 (Dashboard principal) — resumen** (detalle completo en
[docs/06-dashboard.md](docs/06-dashboard.md)): shell autenticado completo
(sidebar + topbar + selector de empresa + menú de usuario), pantalla de
Dashboard con KPIs reales (sucursales, usuarios) y estados vacíos honestos
para lo que todavía no existe (productos, stock, movimientos — Fases 7-9).
Arrancó en código el sistema de diseño (`packages/ui`, sobre **Tailwind
CSS v4 + Radix UI + class-variance-authority**, ya decidido en Fase 1):
`Button`, `Avatar`, `Badge`, `EmptyState`, `StatCard`, `Sidebar`, `Topbar`,
`UserMenu`. Rutas placeholder (`ComingSoon`) para las secciones que llegan
después, nunca enlaces rotos. 13 tests de backend en verde (11 de Fase 5 +
2 nuevos de `/dashboard/summary`).

**Bug real encontrado y corregido en esta fase** (lo notó el usuario en el
navegador, no yo): `LoginPage` (Fase 5) tenía el fondo de la tarjeta
hardcodeado en blanco pero el texto heredaba el color del body, que ahora
sigue el tema claro/oscuro del sistema — con el SO en modo oscuro, el
texto se volvía casi invisible sobre el fondo blanco. Se corrigió
migrando `LoginPage` a los tokens/componentes nuevos (fondo y texto ahora
siempre sincronizados al mismo tema). Se confirmó por grep que no queda
ningún otro color hardcodeado fuera del sistema de tokens en
`apps/web/src`.

**Nota operativa:** durante la verificación en navegador de esta fase,
maté por error un par de procesos de Node al intentar levantar servidores
de prueba — pueden haber sido la sesión `pnpm dev` que el usuario tenía
abierta. Se avisó en el momento y se resolvió reiniciando; no hubo pérdida
de código ni de datos, pero vale la pena tenerlo presente: en esta máquina
suele haber varios procesos `node.exe` sueltos acumulados de sesiones
anteriores — conviene `netstat -ano | grep LISTENING` antes de matar
procesos a ciegas.

**Cuentas reales ya creadas** (adelantando parte de Fase 4/15): **MongoDB
Atlas** (cluster `Cluster0`) y **Upstash Redis** (base `stock-c-dev`,
Oregon). Credenciales en `apps/api/.env`, gitignored, nunca se subieron a
GitHub. Faltan **Vercel** y **Render**.

**Commit y push de Fase 6 hechos** (`ebede6b — feat: dashboard principal y
sistema de diseño en código (Fase 6)`), CI en verde:
https://github.com/Antonio-David-Tejada-Villalon/stock-c/actions/runs/30735451338

**Pendiente inmediato:** aprobar y arrancar Fase 7 — CRUD de productos.

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

**Próximo paso:** Fase 7 — CRUD de productos (solo productos, sin stock
todavía), sobre el modelo `products` ya definido en
[docs/03-modelo-datos.md](docs/03-modelo-datos.md) y los componentes de
formulario/tabla diseñados en
[docs/02-diseno-ui-ux.md](docs/02-diseno-ui-ux.md).

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
| 7 | CRUD de productos | ⚪ pendiente |
| 8 | Categorías, marcas, unidades | ⚪ pendiente |
| 9 | Control de inventario (entradas, salidas, kardex) | ⚪ pendiente |
| 10 | Offline First (IndexedDB/Dexie, Service Workers, sync) | ⚪ pendiente |
| 11 | Reportes | ⚪ pendiente |
| 12 | Notificaciones | ⚪ pendiente |
| 13 | Configuración general | ⚪ pendiente |
| 14 | Optimización | ⚪ pendiente |
| 15 | Deploy | ⚪ pendiente |

Documentos de cada fase se guardan en `docs/NN-nombre-fase.md`.
