# Fase 5 — Autenticación

Estado: **✅ aprobado** (2026-08-02). Verificado por el usuario en
navegador contra infraestructura real (Atlas + Upstash) además de la
verificación técnica de la sección 9.

## 1. Objetivo

Login con email + contraseña, emisión de access token (JWT) y refresh
token (opaco, rotativo), logout con revocación, endpoint de "usuario
actual", autorización por rol/permiso sobre el modelo RBAC ya definido en
Fase 3, y protección de rutas en el frontend.

**Asunción explícita (a confirmar):** esta fase **no** incluye una pantalla
de registro/alta de empresa (self-service signup) — no estaba en el mapa
de fases original y agregarla ahora sería una funcionalidad no pedida. En
su lugar, el primer usuario/empresa se crea con un **script de seed** para
desarrollo. El registro público de empresas puede proponerse como fase
propia más adelante si se quiere.

## 2. Justificación técnica

- **Access token JWT de 15 min + refresh token opaco rotativo en cookie
  httpOnly** — ya decidido en Fase 1 (sección 7). El refresh token es
  opaco (no JWT) y vive hasheado en `sessions` (Fase 3): un JWT de refresh
  no aporta nada aquí y solo complica la revocación; un token opaco se
  invalida con un simple `UPDATE`.
- **Hashing de contraseña con Argon2id** vía `@node-rs/argon2` (bindings
  nativos pre-compilados, sin necesitar toolchain de compilación en la
  máquina de desarrollo) — Argon2id es la recomendación vigente de OWASP
  para hashing de contraseñas, ya mencionado como decisión en Fase 3.
- **RBAC dirigido por datos**, no por un enum en código — reutiliza
  `roles.permissions: string[]` de Fase 3 tal cual, sin cambios al modelo.
- **React Router** para el enrutamiento del frontend (no se había decidido
  en fases anteriores): es la opción más madura y con menor riesgo de
  fricción para rutas protegidas + redirecciones — se deja como decisión
  de bajo riesgo, fácilmente reemplazable, no amerita frenar la fase.

## 3. Arquitectura — impacto y una decisión de seguridad no anticipada

Nuevo módulo `apps/api/src/modules/auth`, dentro del monolito modular ya
definido. En el frontend, `apps/web/src/features/auth`.

**Detalle que Fase 1 no había resuelto porque todavía no existían
proveedores concretos:** con Vercel (frontend) y Render (backend) como
dominios distintos, la cookie del refresh token es necesariamente
**cross-site**, no first-party. Eso obliga a `SameSite=None; Secure`, lo
cual habilita en teoría CSRF sobre cualquier endpoint que dependa de esa
cookie de forma ambiente.

Se decidió **no** implementar un esquema completo de tokens CSRF
(`@fastify/csrf-protection` con doble submit) porque, dado el resto del
diseño, no hace falta y sería complejidad sin beneficio real:

- Todo endpoint de negocio (crear producto, registrar movimiento, etc., en
  fases futuras) se autentica con el **access token por header
  `Authorization: Bearer`**, guardado solo en memoria del frontend — nunca
  en una cookie. Un atacante cross-site no puede leer ni adjuntar ese
  header, así que esos endpoints ya son inmunes a CSRF por diseño, sin
  ningún token adicional.
- Los **únicos** endpoints que dependen de la cookie ambiente son
  `/auth/refresh` y `/auth/logout`. Aunque un sitio malicioso lograra
  disparar una request a esos endpoints, no puede **leer** la respuesta
  (el CORS del API solo permite el origen exacto del frontend, sin
  comodín, con `credentials: true`) — como mucho fuerza una rotación de
  token o un logout no deseado, no una fuga de datos.
- Como capa adicional igualmente barata: ambos endpoints exigen un header
  custom (`X-Requested-With: stock-c`). Un `<form>` cross-site no puede
  agregar headers custom, y un `fetch` cross-site que lo intente dispara
  un preflight CORS que nuestro CORS de origen único rechaza. Es la misma
  defensa que ya usan Django/Rails para esto, sin la complejidad de un
  esquema de doble submit.

Si en el futuro el CORS se relaja (comodín, múltiples orígenes no
confiables) esta defensa deja de alcanzar y hay que pasar a CSRF tokens de
verdad — no es el caso hoy.

## 4. Diseño UI/UX

Reutiliza el mockup de Login de Fase 2. Estados nuevos que ese mockup no
cubría en detalle:

- Botón primario con estado de carga (deshabilitado + spinner) durante el
  submit.
- Mensaje de error inline bajo el formulario ante credenciales inválidas —
  mensaje genérico ("Correo o contraseña incorrectos"), nunca revela cuál
  de los dos campos falló (mitiga enumeración de usuarios).
- Aviso de bloqueo temporal tras varios intentos fallidos (rate limit) con
  el tiempo de espera restante.
- Redirección automática a la última ruta protegida solicitada, tras un
  login exitoso.
- En el shell autenticado (sidebar/topbar de Fase 2): el menú de usuario ya
  tenía el avatar — se le agrega la acción "Cerrar sesión".
- Toast "Tu sesión expiró, iniciá sesión de nuevo" cuando el refresh
  silencioso falla (p. ej. sesión revocada desde otro dispositivo).

## 5. Modelo de datos

Se implementan las colecciones ya diseñadas en Fase 3: `companies`,
`branches`, `roles`, `users`, `sessions`. Sin cambios de esquema respecto a
ese documento. Los contadores de intentos fallidos de login **no** se
guardan en Mongo — los administra `@fastify/rate-limit` en Redis (vía su
propio store, con TTL), consistente con la arquitectura de seguridad de
Fase 1 ("rate limiting respaldado por Redis").

Aislamiento multiempresa: se implementa el plugin de Mongoose mencionado en
la Decisión 3 de Fase 1 — cualquier query sobre un modelo con tenant
(`User`, `Branch`, `Role` no-sistema...) que no incluya `companyId` en el
filtro **lanza una excepción** en vez de ejecutarse. Es un cinturón de
seguridad a nivel de ORM, no reemplaza la disciplina en la capa de
servicio, pero hace que olvidarlo sea un error ruidoso en desarrollo, no
una fuga silenciosa en producción.

## 6. API

| Método y ruta | Body | Respuesta | Notas |
|---|---|---|---|
| `POST /auth/login` | `{ email, password }` | `{ accessToken, user }` + cookie `refresh_token` | Rate-limited (5 intentos / 15 min por email+IP) |
| `POST /auth/refresh` | — (usa cookie) | `{ accessToken }` + rota cookie | Requiere header `X-Requested-With` |
| `POST /auth/logout` | — (usa cookie) | `204` | Revoca la sesión, limpia la cookie |
| `GET /auth/me` | — (Bearer) | `{ user }` | Requiere access token válido |

`user` en las respuestas: `{ id, email, name, role: { name, permissions }, companyId, branchRestrictions }` — nunca incluye `passwordHash`.

## 7. Seguridad

- Argon2id para hashing (parámetros por defecto de `@node-rs/argon2`,
  ajustados a memoria/tiempo razonables para un free-tier de Render).
- Access token JWT firmado (HS256, secreto desde `JWT_ACCESS_SECRET`),
  15 min, incluye `sub`, `companyId`, `roleId`, `permissions` (evita un
  round-trip a Mongo en cada request para chequear permisos).
- Refresh token: 32 bytes aleatorios (`crypto.randomBytes`), se guarda
  **hasheado** (SHA-256) en `sessions.tokenHash` — igual que una
  contraseña, si la base se filtra los refresh tokens no son reutilizables
  directamente. TTL deslizante de 30 días, rotado en cada uso; el token
  anterior se invalida al rotar (si alguien reusa un refresh token ya
  rotado, se interpreta como posible robo y se revocan **todas** las
  sesiones de ese usuario).
- Cookie `refresh_token`: `httpOnly`, `Secure`, `SameSite=None`, `Path=/auth`.
- Rate limiting en `/auth/login` respaldado por Redis
  (`@fastify/rate-limit` con store Redis) — 5 intentos cada 15 min por
  combinación email+IP, mensaje de error sin filtrar cuál dato falló.
- CORS: origen único (`CORS_ORIGIN`), `credentials: true`, sin comodín.
- Mitigación CSRF con header custom en `/auth/refresh` y `/auth/logout`
  (justificado en la sección 3).
- Ningún secreto ni contraseña en logs (Fastify logger configurado para
  redactar `password`, `authorization`, `cookie`).

## 8. Código

- `apps/api/src/db/models/{company,branch,role,user,session}.model.ts` —
  esquemas Mongoose exactamente como se definieron en Fase 3.
- `apps/api/src/db/plugins/tenantScope.ts` — el plugin de aislamiento por
  tenant (sección 5), con un escape hatch explícito
  (`allowCrossTenant: true`) para el único caso legítimo de bypass: ubicar
  a un usuario por email en el login, antes de saber su `companyId`.
- `apps/api/src/plugins/{mongo,redis,jwt,cookie,rateLimit}.ts` — plugins de
  infraestructura de Fastify, cada uno independiente y con `onClose` para
  cerrar conexiones prolijamente.
- `apps/api/src/modules/auth/{password,tokens,auth.service,auth.routes,auth.schemas}.ts`
  — el módulo de autenticación en sí.
- `apps/api/src/middleware/{authenticate,authorize}.ts` — guardas
  reutilizables para rutas futuras (`preHandler: authenticate` +
  `preHandler: authorize('permiso:x')`).
- `apps/api/src/db/seed.ts` — crea empresa + sucursal + roles de sistema +
  usuario Owner de desarrollo (idempotente, se puede correr muchas veces).
- `apps/web/src/features/auth/{api,AuthContext,LoginPage,ProtectedRoute}.tsx`
  — cliente HTTP, estado de sesión (access token solo en memoria, nunca en
  `localStorage`), pantalla de login real con los estados de la sección 4,
  y el guard de rutas.
- `apps/web/src/pages/AppHome.tsx` — placeholder autenticado mínimo (no es
  el dashboard — eso es Fase 6) solo para probar el flujo completo.

## 9. Testing y verificación

**Verificación manual end-to-end contra infraestructura real (2026-08-02):**
esta máquina no tiene Docker instalado, así que en vez de
`docker-compose.yml` se probó contra los servicios gestionados reales de
Fase 4 — adelantando esa parte de Fase 4/15 porque hacía falta para validar
esta fase de verdad, no solo con mocks:

- **MongoDB Atlas** (cluster `Cluster0`, usuario `4vdel777_db_user`) —
  `apps/api/.env` (no versionado). `pnpm --filter @stock-c/api seed` corrió
  contra el cluster real: creó empresa, sucursal, roles de sistema y el
  usuario Owner de desarrollo; se volvió a correr una segunda vez y
  confirmó que es idempotente (detectó todo lo existente, no duplicó nada).
- **Upstash Redis** (base `stock-c-dev`, free tier, Oregon — misma región
  que `render.yaml`, para minimizar latencia login/refresh en producción).
- Con el API real corriendo (`tsx src/server.ts`) contra ambos servicios:
  `GET /health` → 200. `POST /auth/login` → 200, con
  `x-ratelimit-remaining` real en la respuesta y cookie `refresh_token`
  seteada. `GET /auth/me` con el access token → 200. `POST /auth/refresh`
  sin el header `X-Requested-With` → 403 (CSRF funcionando). Con el header
  → 200, rota el token. Todo se comportó exactamente como predicen los
  tests automatizados.

**Tests automatizados** (`apps/api/test/auth.test.ts`, 11 casos, corridos
  con `pnpm --filter @stock-c/api test`): usan `mongodb-memory-server`
  (Mongo real, en memoria, sin Docker) e `ioredis-mock` como cliente Redis
  inyectado en `buildApp()`. Cubren: login válido/inválido/cuenta
  deshabilitada, mensaje genérico ante credenciales incorrectas, `/auth/me`
  con y sin token, rotación de refresh token, **detección de reuso de un
  refresh token ya rotado** (revoca todas las sesiones), logout, rate
  limiting (bloquea al 6º intento, no afecta a otros emails), y el plugin
  de aislamiento por tenant (rechaza queries sin `companyId`, permite el
  escape hatch explícito).
- **Script de seed** verificado dos veces seguidas contra una instancia de
  Mongo en memoria: crea todo en la primera corrida, detecta lo existente
  y no duplica nada en la segunda (idempotente).
- **Bug real encontrado y corregido durante el testing:** el hook por
  defecto de `@fastify/rate-limit` es `onRequest`, que corre *antes* de
  parsear el body — el `keyGenerator` de `/auth/login` leía
  `request.body.email` cuando todavía era `undefined`, así que **todos**
  los intentos de login (sin importar el email) caían en el mismo balde de
  rate limit. Se corrigió fijando `hook: "preHandler"` en la config de esa
  ruta. Sin el test que probaba dos usuarios distintos en paralelo, este
  bug habría llegado a producción.
- **Probado por el usuario en el navegador** (2026-08-02): login con
  `owner@ferreteria-demo.test` funcionó correctamente contra `pnpm dev`
  real, sin errores de consola/red reportados.

## 10. Revisión

**Terminado:** login, refresh rotativo con detección de reuso, logout,
`/auth/me`, RBAC por permisos, aislamiento multiempresa a nivel de ORM,
rate limiting real (con un bug encontrado y corregido por los propios
tests), mitigación CSRF proporcionada al riesgo real, frontend con manejo
de sesión en memoria y pantalla de login funcional, script de seed
idempotente. Todo el monorepo pasa `lint`, `typecheck` y `build`. Verificado
end-to-end contra MongoDB Atlas y Upstash Redis reales, no solo contra
mocks.

**Falta:** gestión de usuarios (invitar, editar, desactivar, cambiar de
rol) no existe todavía — no estaba en el mapa de fases; se puede proponer
como fase propia más adelante. Pantalla de "sesiones activas"
(listar/revocar dispositivos) tampoco se construyó — el backend ya soporta
revocar todas las sesiones de un usuario, falta la UI si se quiere.

**Podría mejorarse:** hoy `/auth/login` no distingue "cuenta no existe" de
"contraseña incorrecta" a propósito (mitiga enumeración de usuarios) — es
correcto tal cual. Si el volumen de intentos de login crece mucho, la
extracción del contador de rate-limit a un servicio dedicado sería una
optimización de Fase 14, no algo que haga falta ahora.
