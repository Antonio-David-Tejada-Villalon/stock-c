# Fase 6 — Dashboard Principal

Estado: **✅ aprobado** (2026-08-02), verificado por el usuario en
navegador.

## 1. Objetivo

Construir el **shell autenticado** que van a compartir todas las pantallas
de acá en adelante (sidebar con navegación + selector de empresa/sucursal,
topbar con usuario) y la pantalla de **Dashboard** con indicadores.

**Asunción explícita (consecuencia directa del orden de fases, no una
decisión nueva):** Productos, Categorías e Inventario todavía no existen —
son las Fases 7, 8 y 9. Así que el dashboard de esta fase muestra:
- KPIs **reales** de lo que sí existe hoy: sucursales, usuarios del equipo.
- **Estados vacíos honestos** para todo lo relacionado a inventario
  ("Disponible cuando actives Productos/Inventario"), nunca un `0` falso
  que sugiera que ya hay datos y están en cero.

## 2. Justificación técnica

- **Se implementa recién ahora el sistema de diseño en código**
  (`packages/ui`, sobre Tailwind + Radix UI + `class-variance-authority`,
  ya decidido en Fase 1 sección 3) porque esta es la primera pantalla con
  navegación persistente que van a reusar todas las fases siguientes —
  seguir escribiendo estilos ad-hoc por pantalla (como se hizo puntualmente
  en el login de Fase 5, razonable para una sola pantalla) no escala a
  partir de acá.
- **Mostrar estados vacíos en vez de ceros** para KPIs de inventario: un
  `0` en "Productos activos" es indistinguible de "ya tenés productos y se
  agotaron todos" — un estado vacío explícito con el motivo ("se activa en
  la Fase 7") no genera esa ambigüedad.
- **Endpoint de resumen separado** (`GET /dashboard/summary`) en vez de
  reusar `/auth/me`: son cosas distintas (identidad vs. métricas), y
  cuando lleguen Fases 9/11 este endpoint va a crecer con datos de stock
  sin tocar el contrato de autenticación.

## 3. Arquitectura

- **Backend:** nuevo módulo `apps/api/src/modules/dashboard/` — reusa el
  middleware `authenticate` de Fase 5, consulta `Branch` y `User` (ya
  scoped por tenant vía el plugin de Fase 5).
- **Frontend:** se introduce un layout compartido
  (`apps/web/src/app/AppShell.tsx`) con `<Outlet/>` de `react-router-dom`.
  Las rutas de navegación que todavía no existen (Productos, Movimientos,
  Reportes, Configuración) apuntan a una pantalla placeholder compartida
  (`ComingSoon`) en vez de a un 404 — son enlaces reales del sidebar, no
  pueden llevar a una ruta rota.
- **`packages/ui`** deja de estar vacío: `tokens.css` (paleta/tipografía/
  espaciado de Fase 2, como variables CSS) + los componentes que esta
  pantalla necesita: `Button`, `Avatar`, `Badge`, `EmptyState`, `Sidebar`,
  `Topbar`, `StatCard`. No se construye el catálogo completo de Fase 2 de
  una — solo lo que esta pantalla consume; el resto se agrega cuando haga
  falta en cada fase.

## 4. Diseño UI/UX

Reutiliza el mockup de Dashboard+Sidebar de Fase 2 con un ajuste: la tabla
de "Movimientos recientes" del mockup se reemplaza acá por un
`EmptyState` ("Sin movimientos aún — se activa en la Fase 9"), porque
`stockMovements` no existe todavía. El resto (sidebar, selector de
empresa/sucursal, topbar, fila de KPIs) se implementa tal cual se diseñó.

KPIs de esta fase:
- **Sucursales** — cuenta real (`Branch`, activas).
- **Usuarios del equipo** — cuenta real (`User`, activos).
- **Productos activos**, **Stock bajo**, **Movimientos hoy** — tarjetas en
  estado vacío con el motivo y la fase que los activa.

## 5. Modelo de datos

Ninguna colección nueva. Se leen `branches` y `users` ya definidas en
Fase 3, sin cambios de esquema.

## 6. API

| Método y ruta | Respuesta | Notas |
|---|---|---|
| `GET /dashboard/summary` | `{ branchCount, activeUserCount }` | Requiere Bearer token (`authenticate`) |

## 7. Seguridad

Nada nuevo respecto a Fase 5: la ruta exige access token válido
(`preHandler: authenticate`) y las queries van scoped por `companyId` del
token — mismo patrón que ya se usa en `auth.service.ts`, ninguna query
nueva sin tenant.

## 8. Código

- **Backend:** `apps/api/src/modules/dashboard/dashboard.routes.ts` —
  único endpoint, reusa `authenticate` de Fase 5, consulta `Branch`/`User`
  en paralelo (`Promise.all`).
- **`packages/ui`** deja de estar vacío:
  - `tokens.css` — paleta/tipografía/espaciado de Fase 2 como variables CSS
    (claro, oscuro por `prefers-color-scheme`, y override explícito por
    `[data-theme]`).
  - `Button`, `Avatar`, `Badge`, `EmptyState`, `StatCard`, `Sidebar` (+
    `SidebarBrand`/`SidebarSection`/`SidebarNavItem`/`SidebarFooter`),
    `Topbar` (+ `TenantSwitch`), `UserMenu` (Radix `DropdownMenu`, con
    manejo de foco/teclado correcto out-of-the-box).
- **Tailwind CSS v4** integrado vía `@tailwindcss/vite`, con `@theme`
  mapeando las utilidades (`bg-accent`, `text-text-secondary`, etc.) a las
  variables de `tokens.css` — cambiar de tema no requiere tocar ninguna
  clase, solo la variable CSS de raíz.
- **Frontend:** `apps/web/src/app/AppShell.tsx` (layout con `<Outlet/>`),
  `pages/DashboardPage.tsx`, `pages/ComingSoon.tsx` (placeholder honesto
  para Productos/Movimientos/Reportes/Configuración — enlaces reales del
  sidebar, nunca rotos). `App.tsx` reestructurado con rutas anidadas bajo
  `ProtectedRoute` → `AppShell`.
- **Reescrito `LoginPage.tsx`** (Fase 5) para usar los tokens/componentes
  nuevos en vez de los estilos ad-hoc que tenía — ver bug encontrado en la
  sección 9.

## 9. Testing y verificación

- **2 tests automatizados nuevos** (`apps/api/test/dashboard.test.ts`,
  mismo patrón que Fase 5 — `mongodb-memory-server` + `ioredis-mock`):
  exige Bearer token, y devuelve conteos scoped a la empresa del que llama
  excluyendo sucursales/usuarios inactivos. Los 13 tests del backend
  (11 de Fase 5 + 2 nuevos) pasan.
- `lint` / `typecheck` / `build` de los 5 paquetes en verde. El bundle de
  `apps/web` pasó de 143KB a 264KB (87KB gzip) al incorporar Tailwind +
  Radix — esperable al ser la primera pantalla con navegación real; se
  revisita en Fase 14 si hace falta.
- Verifiqué en el CSS compilado que Tailwind generó correctamente las
  utilidades sobre nuestros tokens (`bg-accent`, `border-border`, etc.),
  confirmando que el escaneo de `packages/ui` funciona.
- **Bug real encontrado por el usuario en el navegador** (no por mí):
  `LoginPage.tsx` (Fase 5) tenía un fondo de tarjeta hardcodeado en blanco
  (`background: "#fff"`) pero el texto sin color heredaba de `body`, que
  ahora sigue el tema oscuro/claro del sistema (agregado en esta fase). Con
  el sistema operativo en modo oscuro, el texto se volvía casi blanco
  sobre un fondo blanco — invisible. Se corrigió migrando `LoginPage` a los
  tokens/componentes de Tailwind, que mantienen fondo y texto sincronizados
  al mismo tema siempre. Quedó como aprendizaje: cualquier color
  hardcodeado por fuera del sistema de tokens es un bug de tema esperando
  pasar — se confirmó (grep) que no queda ningún otro caso así en
  `apps/web/src`.
- **Incidente operativo (no de código):** al intentar levantar servidores
  de desarrollo para verificar visualmente, maté por error un par de
  procesos que podrían haber sido la sesión de `pnpm dev` que el usuario
  tenía abierta de la Fase 5. Se avisó de inmediato y se le pidió que
  revisara/reiniciara su terminal — quedó resuelto sin pérdida de datos ni
  de código, solo un proceso a reiniciar.
- Probado por el usuario en el navegador: login (con el bug de contraste
  ya corregido) y el Panel completo (sidebar, KPIs reales de sucursales y
  usuarios, estados vacíos de inventario, menú de usuario con logout).

## 10. Revisión

**Terminado:** shell autenticado completo (sidebar, topbar, selector de
empresa, menú de usuario), pantalla de Dashboard con KPIs reales donde hay
datos y estados vacíos honestos donde no, sistema de diseño arrancado en
código (`packages/ui` sobre Tailwind + Radix + CVA, tal como se decidió en
Fase 1), rutas placeholder para las secciones que llegan en fases
siguientes. `LoginPage` de Fase 5 migrado al mismo sistema de tokens.

**Falta:** el catálogo completo de componentes de Fase 2 (Tabs, Modal,
Toast, paleta de comandos, Tabla) no se construyó — se agrega cuando una
fase futura los necesite de verdad, no antes. Gestión real de
sucursales/empresa (crear, editar) no existe — no estaba pedida para esta
fase.

**Podría mejorarse:** nada bloqueante. El selector de empresa/sucursal
hoy es solo informativo (no hay nada más para elegir con una sola
sucursal) — se vuelve interactivo cuando exista una fase de gestión de
sucursales.
