# Fase 13 — Configuración general

Estado: **🟡 en curso**.

## 1. Objetivo

Autogestión de la empresa desde la app, sin tocar la base a mano (hoy
`Company` y `Branch` solo los toca `seed.ts`, y no existe forma de
crear un segundo usuario salvo directo en Mongo). Alcance confirmado
con el usuario:

1. **Datos de la empresa** (nombre, CUIT/taxId, zona horaria, moneda).
2. **Sucursales**: CRUD administrativo, manteniendo la invariante de
   Fase 9 de **exactamente una sucursal activa** — activar una
   desactiva la anterior. Multisucursal real (varias activas a la vez,
   selector, stock por sucursal) queda fuera — es un cambio grande que
   toca Inventario/Reportes/Notificaciones/Offline, se decidió que
   merece su propia fase si se pide.
3. **Usuarios**: perfil propio (nombre/contraseña/avatar) + gestión de
   equipo (Owner/Admin invita, crea, desactiva y asigna uno de los 4
   roles de sistema ya existentes a otros usuarios de la empresa). Sin
   editor de roles/permisos custom (`role:manage` queda sin consumir,
   para una fase futura si se pide).
4. **Apariencia**: tema claro/oscuro (ya existía en la topbar, se suma
   también acá) + color de acento personalizable por empresa, validado
   por contraste WCAG.
5. **Branding**: logo y favicon de empresa, solo URL de texto (sin
   subida de archivos — no hay object storage configurado, mismo
   criterio que `imageUrl` de Categorías).
6. **Datos**: accesos directos a los 4 exports CSV de Reportes (Fase
   11) + un export nuevo que no existe en ningún lado hoy (catálogo
   completo de productos, sin agregación ni rango de fechas).

## 2. Justificación técnica

- **Sucursales — invariante de una sola activa, no CRUD libre.**
  `resolveActiveBranch()` (Fase 9/11, `db/helpers/`) asume exactamente
  una sucursal activa por empresa y **falla fuerte** (`500
  no_active_branch`) si hay cero o más de una — lo consume Inventario,
  Reportes, el Panel y ahora Notificaciones. Dejar crear sucursales
  activas libremente rompería los cuatro módulos. Por eso `POST
  /branches/:id/activate` desactiva atómicamente todas las demás de la
  empresa antes de activar la elegida — sin transacción de Mongo (dos
  updates secuenciales, mismo criterio de riesgo que el `move()` de
  Categorías: en el peor caso, una carrera deja el estado
  momentáneamente inconsistente, no hay pérdida de datos).
- **Usuarios nuevos sin infra de email.** El proyecto no tiene proveedor
  de mail configurado (misma razón por la que Fase 12 no manda
  notificaciones por email). Un flujo de invitación por link
  emailado no es viable hoy. En cambio, el Owner/Admin que crea un
  usuario nuevo **fija la contraseña inicial directamente** en el
  formulario — se la comunica al usuario por fuera del sistema (mismo
  patrón que ya usa `seed.ts` con el usuario Owner, que imprime la
  contraseña por consola). No se agrega un flag de "cambiar contraseña
  en el primer login" — no lo pidió el usuario y suma un estado nuevo
  (`mustChangePassword`) más una rama en el flujo de login; queda
  anotado como mejora posible.
- **Asignación de rol, no edición de roles.** `ROLE_MANAGE` ya existe
  en `PERMISSIONS` desde Fase 5 pero nunca se consumió — esta fase le
  da uso a `USER_MANAGE` (asignar uno de los 4 `SYSTEM_ROLES` a un
  usuario) pero no construye un editor de permisos custom. Eso es un
  sub-sistema propio (UI de checkboxes por permiso, validación de que
  no queden roles huérfanos, etc.) que no se pidió — se agrega si hace
  falta en una fase futura.
- **Guardas de seguridad nuevas, no obvias:** un usuario no puede
  desactivarse a sí mismo desde "gestión de equipo" (usar el logout,
  no esto), y no puede quitarse el rol Owner si es el único usuario
  Owner activo de la empresa — sin esto, la empresa podría quedar sin
  ningún usuario con permisos de administración, sin forma de
  recuperarse salvo tocando la base a mano.
- **Color de acento — validado por contraste, no una lista cerrada de
  presets.** La adenda de branding (docs/02) ya descartó el Naranja de
  marca como `--accent` único porque el contraste de texto blanco
  sobre él falla WCAG AA (~2.86:1). En vez de restringir a una paleta
  curada fija, se reutiliza la misma fórmula (luminancia relativa
  sRGB) para calcular el contraste del color elegido contra blanco y
  contra un texto oscuro casi-negro al guardar — si **ninguno** de los
  dos pasa AA (≥ 4.5:1), se rechaza mostrando el ratio calculado. Deja
  elegir cualquier color de marca real de una empresa, con la misma
  garantía de legibilidad que ya se aplicó a Stock-C mismo. Nueva
  utilidad compartida `lib/contrast.ts` (server, autoridad) con una
  copia liviana en el cliente (feedback inmediato en el formulario,
  sin round-trip solo para validar).
- **El acento personalizado se aplica en runtime, no en `tokens.css`.**
  `tokens.css` sigue siendo el default de marca de Stock-C (login,
  cualquier pantalla sin empresa cargada). Una vez autenticado, un
  hook (`useCompanyBranding`) sobrescribe `--accent` y
  `--accent-contrast` (blanco o casi-negro, el que haya pasado la
  validación de contraste al guardar) como variables inline en
  `:root` a partir de `company.settings.accentColor` — mismo mecanismo
  que ya usa el toggle de tema (`data-theme` en `documentElement`), sin
  tocar el archivo de tokens. **No** se derivan `--accent-hover`/
  `--accent-wash` del color elegido (la dirección del hover es distinta
  entre tema claro/oscuro — más oscuro en claro, más claro en oscuro —
  derivarlo bien requiere conversión HSL con esa lógica; se deja con el
  shade default de Stock-C como límite de alcance explícito de esta
  primera versión, anotado en Revisión).
- **Logo/favicon: URL de texto, mismo criterio que Categorías.** No
  hay object storage configurado (ni proveedor, ni env vars, ni
  componente de subida — confirmado otra vez, mismo gap documentado en
  la adenda de Categorías y en `docs/07-productos.md`). Construirlo
  ahora sería adelantar una decisión de infraestructura (Vercel Blob
  u otro proveedor) fuera del alcance de esta fase.
- **Exportación: reusa Reportes, no lo duplica.** Los 4 CSV de Fase 11
  (valorización, movimientos, resumen, stock bajo) ya existen — la
  sección "Datos" linkea directo a esas pestañas en vez de reconstruir
  la misma lógica. El único export genuinamente nuevo es el catálogo
  completo de productos (fila por SKU, sin agrupar ni acotar por
  fecha) porque no hay ningún lugar hoy que lo ofrezca — ni Productos
  ni Reportes.
- **Permisos nuevos**: `company:update` (Owner/Admin), `branch:manage`
  (Owner/Admin) — mismo esquema de string libre que el resto desde
  Fase 5. `user:manage` ya existía sin consumir, se usa tal cual.
  `PATCH /auth/me` y `POST /auth/change-password` (perfil propio) no
  llevan permiso — alcanza con `authenticate`, un usuario siempre puede
  editar sus propios datos.

## 3. Arquitectura

- Backend, tres módulos nuevos bajo `apps/api/src/modules/`:
  - `company/` — `company.schemas.ts`, `company.service.ts`,
    `company.routes.ts`. Sin `list`: es un singleton por tenant
    (`companyId` sale del token).
  - `branches/` — CRUD propio (no el factory genérico de
    `catalogs/simpleCatalog`, por la invariante de una sola activa,
    igual criterio que Categorías vs. Marcas/Unidades en Fase 8).
  - `users/` — gestión de equipo (`list`/`create`/`update`).
- `auth` module (Fase 5) suma dos rutas para perfil propio:
  `PATCH /auth/me`, `POST /auth/change-password` — viven ahí, no en
  `users/`, porque operan sobre `request.user.sub` (uno mismo), no
  reciben un `:id` ni exigen `user:manage`.
- `apps/api/src/lib/contrast.ts` (nuevo): `relativeLuminance(hex)`,
  `contrastRatio(hexA, hexB)`, `passesAA(hex)` (contra blanco y
  casi-negro). Reutilizado por `company.service.ts` al validar
  `accentColor`.
- Frontend: `apps/web/src/pages/ConfiguracionPage.tsx` reemplaza el
  `ComingSoon` de `/configuracion` — mismo patrón de `Tabs` que
  Categorías: Empresa / Sucursales / Usuarios / Apariencia / Datos.
- `apps/web/src/theme/useCompanyBranding.ts` (nuevo): aplica
  `accentColor`/`logoUrl`/`faviconUrl` de la empresa autenticada sobre
  `:root` y el `<link rel="icon">` — se monta una vez en `AppShell`,
  separado de `ThemeContext` (claro/oscuro sigue siendo ortogonal).
- `packages/ui/src/Logo.tsx` (Fase 2 adenda) suma una prop opcional
  `imageUrl` — si la empresa cargó un logo propio, se muestra esa
  imagen en vez del isotipo hexagonal de Stock-C.

## 4. Diseño UI/UX

- Misma dirección que el resto (Linear/Notion): tabs arriba, formulario
  simple por sección, sin modal para "Empresa"/"Apariencia" (son
  singleton, se edita in-place con un botón "Guardar" al pie) y
  `Drawer` lateral para Sucursales/Usuarios (siguen el patrón de lista
  + alta/edición ya usado en Categorías/Productos).
- **Empresa:** formulario simple (nombre, CUIT, zona horaria, moneda).
- **Sucursales:** tabla con nombre/código/dirección/estado, botón
  "Activar" en las inactivas (con confirmación: "esto desactivará
  Sucursal Central" para que el efecto colateral sea explícito, no
  sorpresivo).
- **Usuarios:** tabla con nombre/email/rol/estado; alta con
  nombre/email/rol/contraseña inicial (con un botón "Generar" que
  arma una contraseña aleatoria visible, para no forzar al Owner a
  inventar una); "Mi perfil" como sub-sección separada arriba de la
  tabla de equipo (nombre/contraseña propia).
- **Apariencia:** el mismo control de tema que ya está en la topbar,
  más un `<input type="color">` + swatches preset para el acento (
  mismo patrón visual que el selector de color de Categorías) con el
  ratio de contraste calculado en vivo y un mensaje de error claro si
  no pasa AA — igual que Categorías valida el formato hex en vivo.
- **Branding:** dos campos de URL (logo, favicon) con preview chico,
  mismo patrón que `imageUrl` de Categorías.
- **Datos:** lista de accesos directos a Reportes (con un ícono y una
  descripción de una línea cada uno) + un botón "Exportar catálogo
  completo (CSV)".
- Todo detrás de permisos: quien no tiene `company:update` ve la
  pestaña Empresa en solo lectura; sin `branch:manage`/`user:manage`,
  esas pestañas no muestran botones de alta/edición (mismo criterio
  que el resto del sistema).

## 5. Modelo de datos

- `Company.settings` suma `accentColor?: string` (hex, validado por
  contraste) y `logoUrl?: string` / `faviconUrl?: string` (texto, sin
  validar más que longitud).
- `Branch`: sin campos nuevos — el cambio es de comportamiento
  (invariante de una sola activa), no de esquema.
- `User`: sin campos nuevos (`avatarUrl` ya existía desde Fase 3, sin
  usar hasta ahora).

## 6. API

| Método y ruta | Body | Respuesta | Permiso |
|---|---|---|---|
| `GET /company` | — | `{ company }` | autenticado |
| `PATCH /company` | `{ version, name?, taxId?, settings? }` | `{ company }` (400 `invalid_contrast` si `accentColor` no pasa AA) | `company:update` |
| `GET /branches` | — | `{ items[] }` | autenticado |
| `POST /branches` | `{ name, code, address? }` | `201 { branch }` (se crea inactiva) | `branch:manage` |
| `PATCH /branches/:id` | `{ version, name?, code?, address? }` | `{ branch }` | `branch:manage` |
| `POST /branches/:id/activate` | — | `204`, desactiva las demás | `branch:manage` |
| `GET /users` | — | `{ items[] }` | `user:manage` |
| `POST /users` | `{ name, email, password, roleName }` | `201 { user }` | `user:manage` |
| `PATCH /users/:id` | `{ version, name?, roleName?, active? }` | `{ user }` (400 `cannot_deactivate_self`/`last_owner`) | `user:manage` |
| `PATCH /auth/me` | `{ name?, avatarUrl? }` | `{ user }` | autenticado |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` | `204` (401 si `currentPassword` no coincide) | autenticado |

El export de catálogo completo **no suma un endpoint nuevo** — igual
que los 4 reportes de Fase 11, se arma en el cliente paginando con el
ya existente `GET /products` (+ `GET /categories`/`brands`/`units`
para los nombres) y bajando CSV con `lib/csv.ts`. Evita duplicar una
ruta que ya existe solo para saltear la paginación.

## 7. Seguridad

Todas las rutas exigen `authenticate`; las de escritura exigen además
el permiso de la tabla. Todo scoped por `companyId` del token,
reforzado por `tenantScopePlugin`. `change-password` reautentica
(exige `currentPassword`) antes de aceptar la nueva — una sesión
robada sin la contraseña actual no puede tomar la cuenta. `PATCH
/users/:id` bloquea explícitamente desactivarse a uno mismo y quitarle
el rol Owner al único Owner activo restante. `POST /branches/:id/activate`
no usa transacción de Mongo (justificado en Justificación técnica) —
aceptable porque no es dato financiero, a diferencia de
`stockMovements`.

## 8. Código

- **Backend:** `apps/api/src/lib/contrast.ts` (nuevo);
  `apps/api/src/modules/{company,branches,users}/*` (nuevo, 3 módulos
  con schemas/service/routes); `apps/api/src/modules/auth/{auth.schemas.ts,
  auth.service.ts, auth.routes.ts}` suman `PATCH /auth/me` y `POST
  /auth/change-password`; `apps/api/src/db/models/company.model.ts`
  suma `settings.accentColor/logoUrl/faviconUrl`. Registrado en
  `app.ts`. Permisos nuevos `company:update`/`branch:manage` en
  `shared-types` (`user:manage` ya existía sin consumir).
- **Frontend:** `apps/web/src/pages/ConfiguracionPage.tsx` (tabs,
  reemplaza el `ComingSoon`); `apps/web/src/features/settings/*`
  (nuevo: `api.ts`, `EmpresaPanel.tsx`, `SucursalesPanel.tsx` +
  `BranchFormDrawer.tsx`, `UsuariosPanel.tsx` + `TeamUserFormDrawer.tsx`
  + `MiPerfilForm.tsx`, `AparienciaPanel.tsx`, `DatosPanel.tsx`);
  `apps/web/src/lib/contrast.ts` (copia liviana para feedback en vivo);
  `apps/web/src/theme/useCompanyBranding.ts` (nuevo, aplica
  acento/favicon/logo en runtime, montado en `AppShell`);
  `packages/ui/src/Logo.tsx` suma `imageUrl?`; `AuthContext` suma
  `setUser()` para reflejar la edición de perfil sin recargar.
- `packages/shared-types`: `Company`, `CompanySettings`, `Branch`,
  `BranchListResponse`, `TeamUser`, `TeamUserListResponse`,
  `SYSTEM_ROLE_NAMES`, `AuthUser.avatarUrl`.
- El export de catálogo (`DatosPanel.tsx`) no suma endpoint — pagina con
  `GET /products` ya existente y arma el CSV en el cliente, mismo
  patrón que Reportes (Fase 11).
- `seed.ts` no necesitó cambios: `ensureSystemRoles()` ya usa
  `Object.values(PERMISSIONS)` (Fase 12 lo corrigió a `$set`), así que
  los 2 permisos nuevos llegan solos a Owner/Admin en la próxima corrida.

## 9. Testing y verificación

**18 tests nuevos** en `apps/api/test/settings.test.ts` (standalone
`MongoMemoryServer`, sin transacciones en ningún flujo de esta fase):
lectura pública de `/company` vs. `PATCH` gateado por permiso, edición
de nombre/settings, rechazo de `accentColor` sin contraste suficiente
(`#777777`, el gris que minimiza el mejor contraste posible por debajo
de 4.5:1) y aceptación de uno válido; sucursales nacen inactivas,
código duplicado rechazado, activar una desactiva las demás, permiso
exigido; alta de usuario con contraseña fijada por el admin (login
inmediato con esa contraseña), email duplicado rechazado, no
auto-desactivarse, no se puede sacar el rol Owner al único Owner activo,
cambio de rol a un usuario que no es el único Owner sí funciona; perfil
propio (`PATCH /auth/me`) sin permiso especial, `change-password`
rechaza contraseña actual incorrecta y funciona con la correcta (login
con la nueva confirma el cambio real); aislamiento por tenant en
empresa/sucursales/usuarios. **85 tests de backend en total** (67
previos + 18 nuevos), todos en verde. `lint`/`typecheck`/`build` de
los 5 paquetes en verde.

## 10. Revisión

Incidentes reales encontrados por Antonio al verificar en navegador, todos
corregidos en la misma sesión, antes de commitear:

1. **Empresa**: el nombre editado nunca se reflejaba en ningún lugar
   visible — `AppShell.tsx` mostraba `Empresa ${companyId.slice(-4)}`
   hardcodeado, sin leer nunca el nombre real guardado. Fix:
   `useCompanyBranding()` ahora también devuelve `companyName` (mismo
   fetch a `/company` que ya hacía para el acento), usado en el
   `TenantSwitch` del sidebar.

2. **Usuarios**: dos vacíos reales en el flujo de "el admin fija la
   contraseña a mano" (diseño original de esta fase): (a) la contraseña
   generada se perdía apenas se cerraba el drawer de creación, sin
   ninguna pantalla de confirmación — si el admin no la copiaba a mano
   antes de cerrar, quedaba irrecuperable; (b) no existía ninguna forma
   de restablecer la contraseña de un usuario del equipo después de
   creado. Fix: `PATCH /users/:id` acepta un `password` opcional
   (hashea y reemplaza); el drawer de creación muestra una pantalla de
   confirmación con las credenciales + botón "Copiar" antes de
   cerrarse; el drawer de edición suma "Restablecer contraseña…".
   Además, tras probar la sección "Equipo" ya funcionando, se pidió
   explícitamente el CRUD completo — hasta acá solo tenía Crear/Leer/
   Actualizar, faltaba Delete (y el email tampoco era editable
   después de creado). Se sumó `DELETE /users/:id` (borrado
   definitivo, no desactivación — a diferencia del resto del sistema,
   que solo desactiva; los movimientos de stock que el usuario haya
   creado no se tocan, `createdBy` queda apuntando a un id que ya no
   resuelve, igual que el patrón de "otro usuario" ya usado en la
   adenda de duplicados de Fase 9) con las mismas dos guardas que
   `update()` — no podés borrarte a vos mismo, ni borrar al único
   Admin activo (esta segunda guarda es defensiva: con el modelo de
   permisos actual, donde solo Admin tiene `user:manage`, no es
   alcanzable en la práctica porque el actor siempre cuenta como "otro
   admin" salvo que se esté borrando a sí mismo, caso ya cubierto por
   la primera guarda) — y `email` opcional en `PATCH /users/:id`, con
   el mismo `duplicate_email` si choca. El botón "Eliminar usuario" en
   el drawer de edición pide confirmación explícita antes de llamar al
   endpoint.

3. **Apariencia**: pedido explícito de una paleta "más detallada y
   profesional" en vez del picker mínimo original. Ampliada a 16
   colores curados en 4 grupos temáticos, cada uno verificado por
   script que pasa WCAG AA (≥4.5:1) antes de incluirse en la paleta; se
   agregó una vista previa en vivo (botón/insignia/enlace con el color
   elegido) y el acento se aplica al toque al guardar (antes pedía
   recargar la página). De paso se agregaron los campos de Logo y
   Favicon (URL) — estaban conectados de punta a punta en el backend
   desde el diseño original de la fase pero no tenían ningún campo en
   pantalla, vacío real del pedido inicial.

4. **Datos**: sin cambios de código, solo se aclaró su propósito
   (enlaces a los 4 reportes de Fase 11 + export nuevo de catálogo
   completo) porque no era evidente desde la UI.

5. **Sucursales — multisucursal real, explícitamente rechazado por
   ahora**: se pidió que las sucursales se pudieran "administrar como
   un subsistema, similar al admin pero subordinado" — al indagar, esto
   describe stock y movimientos separados por sucursal con selector,
   que es justo la funcionalidad que esta fase ya había dejado fuera de
   alcance (ver "Descartado" en Justificación técnica). Se mantiene
   fuera; es candidata a fase propia si se pide más adelante. Aparte,
   el CRUD de sucursales tenía el mismo vacío que Usuarios: sin Delete.
   Se sumó `DELETE /branches/:id` (borrado definitivo, mismo criterio
   que Usuarios) con una sola guarda — no se puede eliminar la
   sucursal activa, porque dejaría a la empresa sin ninguna operable
   hasta que alguien active otra a mano; las inactivas no se
   referencian en ninguna consulta en vivo (el sistema siempre opera
   contra "la sucursal activa", Fase 9), así que eliminar una inactiva
   no rompe nada visible. El botón "Eliminar" en la tabla solo aparece
   para sucursales inactivas.

6. **Roles: Owner y Admin fusionados en un solo rol "Admin"** — se
   señaló que Owner y Admin eran casi idénticos (la única diferencia
   real, `role:manage`, no se ejercía en ninguna pantalla porque esta
   fase no construyó un editor de roles). Decisión: eliminar Owner,
   Admin queda como único rol de control total (todos los permisos,
   incluido `role:manage`). Cambios: `SYSTEM_ROLES`/`SYSTEM_ROLE_NAMES`
   pasan de 4 a 3 valores; la guarda de seguridad "nunca te podés
   quedar sin administrador" (antes `last_owner`, atada al último Owner
   activo) pasa a `last_admin`, protegiendo al último Admin activo;
   `seed.ts` migra en cada corrida cualquier usuario que haya quedado
   con el rol "Owner" de una corrida anterior a Admin, y borra el rol
   viejo — corrido contra la base real de desarrollo, migró 1 usuario.
   El login `owner@ferreteria-demo.test` se mantiene sin cambios (mismo
   email, ahora con rol Admin).

**24 tests nuevos** en `settings.test.ts` (no 18): se sumaron durante
esta revisión "restablece la contraseña de un usuario del equipo",
"actualiza el email de un usuario del equipo", "un usuario no puede
eliminarse a sí mismo", "elimina definitivamente un usuario del
equipo", "no se puede eliminar la sucursal activa" y "elimina
definitivamente una sucursal inactiva". **91 tests de backend** al
cerrar esta fase (67 previos + 24 nuevos), todos en verde;
`typecheck`/`lint` de los 5 paquetes en verde. (La detección de
"posible duplicado" entre operadores, pedida en la misma ronda de
feedback, es funcionalidad de Fase 9/10 — inventario, no configuración
— documentada como adenda en
[docs/09-control-inventario.md](docs/09-control-inventario.md); sumada
aparte, el total real del backend es 95.)

Se crearon credenciales de prueba en la base real para verificar la
matriz de permisos: `admin@ferreteria-demo.test`,
`operador@ferreteria-demo.test`, `visor@ferreteria-demo.test`
(contraseña `Prueba-2026!`).

_Pendiente: nueva verificación en navegador antes de aprobar y
commitear la fase._
