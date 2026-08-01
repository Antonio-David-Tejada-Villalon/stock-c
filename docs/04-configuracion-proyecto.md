# Fase 4 — Configuración del Proyecto

Estado: **borrador para aprobación**. Sin funcionalidades de negocio — solo
esqueleto, herramientas y configuración de despliegue.

## 1. Objetivo

Dejar el repositorio, el monorepo, el linting y el despliegue configurados
y verificados end-to-end (`install` → `lint` → `typecheck` → `build` →
servidor corriendo) para que las fases 5 en adelante empiecen a agregar
funcionalidad sobre una base que ya compila y ya tiene un camino de
despliegue real, no hipotético.

## 2. Justificación técnica — incorporación de proveedores concretos

El usuario confirmó el flujo de despliegue real: **GitHub → Vercel
(frontend) + Render (backend) + MongoDB Atlas (base de datos)**. Esto
reemplaza el "a definir en Fase 15" que había quedado abierto en la
sección 9 de [01-arquitectura.md](01-arquitectura.md) — se documenta ahí
mismo y se implementa acá, antes de tiempo mejor que después, porque cambia
detalles concretos de configuración (variables de entorno, CORS, comandos
de build) que conviene tener bien desde el primer commit.

Para Redis se eligió **Upstash** (serverless, tier gratuito real) en vez de
un Redis siempre encendido en Render, coherente con la Decisión 5 de Fase 1
("gratis para desarrollar, pagar solo si el producto crece") — un servicio
Redis dedicado en Render cuesta desde el día 1 aunque no tenga tráfico;
Upstash cobra por uso, que a esta escala inicial es $0.

## 3. Arquitectura — cómo afecta al resto del sistema

- El monolito modular (Decisión 1, Fase 1) se traduce en monorepo: una app
  de frontend, una de backend, y paquetes compartidos — no en múltiples
  repositorios ni servicios separados.
- El aislamiento por `companyId` y el resto del modelo de datos (Fase 3) no
  se implementan todavía; esta fase solo prepara el lugar donde van a vivir
  (`apps/api/src/modules`, todavía vacío).
- CORS del backend (`CORS_ORIGIN`) es la primera pieza de seguridad
  real que conecta frontend y backend como dos dominios distintos (Vercel
  y Render), tal como se decidió en la arquitectura física de Fase 1.

## 4. Estructura del repositorio

```
STOCK-C/
├─ apps/
│  ├─ web/            React + Vite + TS → Vercel
│  │  └─ src/
│  └─ api/             Fastify + TS → Render
│     └─ src/
│        ├─ modules/    (vacío — módulos de dominio a partir de Fase 5+)
│        ├─ plugins/    (health check por ahora)
│        └─ shared/     (env, utilidades transversales)
├─ packages/
│  ├─ ui/               Sistema de diseño (vacío — Fase 6+)
│  ├─ shared-types/     Tipos TS compartidos web↔api (vacío — Fase 7+)
│  └─ config/           tsconfig.base.json compartido
├─ docs/                Un documento por fase, este incluido
├─ .github/workflows/   CI (lint + typecheck + build en cada push/PR)
├─ docker-compose.yml   Mongo (replica set) + Redis/Valkey en local
├─ render.yaml          Config del servicio de backend en Render
├─ vercel.json          Config de build del frontend en Vercel
├─ turbo.json           Pipelines de Turborepo (build/dev/lint/typecheck)
├─ pnpm-workspace.yaml  Workspaces del monorepo
└─ CLAUDE.md            Reglas de trabajo del proyecto
```

## 5. Configuración

- **Gestor de paquetes:** pnpm (instalado vía npm global en esta máquina,
  sin necesitar permisos de administrador) + Turborepo para orquestar
  tareas entre paquetes con caché.
- **TypeScript:** `strict: true` + `noUncheckedIndexedAccess` en la base
  compartida (`packages/config/tsconfig.base.json`) — cualquier acceso a
  índice de array/objeto que pueda ser `undefined` debe manejarse
  explícitamente, previene una clase entera de bugs en tablas/listados.
- **ESLint:** flat config (`eslint.config.js`) con `typescript-eslint` +
  `eslint-config-prettier` (para que ESLint nunca compita con Prettier por
  formato).
- **Prettier:** comillas dobles, punto y coma, `trailingComma: all`.
- **Docker Compose (solo desarrollo local):** Mongo 7 con replica set de un
  solo nodo — necesario porque la Decisión 2 de Fase 3 (sincronización
  transaccional `stockMovements` ↔ `stockLevels`) requiere transacciones
  multi-documento, que Mongo solo soporta con replica set, incluso en
  local. Redis se corre como **Valkey** (ver nota de licenciamiento en
  Fase 1, sección 9) para no depender de la licencia source-available de
  Redis ni siquiera en desarrollo.

## 6. Variables de entorno

| Variable | Dónde | Se usa desde |
|---|---|---|
| `VITE_API_URL` | `apps/web` | Fase 4 (ya wireado, ver `App.tsx`) |
| `PORT`, `CORS_ORIGIN`, `NODE_ENV` | `apps/api` | Fase 4 |
| `MONGODB_URI` | `apps/api` | Fase 5/9 (documentada ya, sin usar todavía) |
| `REDIS_URL` | `apps/api` | Fase 5/10 (documentada ya, sin usar todavía) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `apps/api` | Fase 5 |

Cada app tiene su `.env.example` versionado; los `.env` reales nunca se
commitean (`.gitignore`). En Render y Vercel estas variables se cargan
desde el dashboard de cada plataforma (o desde `render.yaml`, que ya deja
declaradas las que hay que completar a mano — connection strings y
secretos no se generan solos).

## 7. Despliegue — qué queda listo y qué falta

**Listo (config-as-code, versionado):**
- `render.yaml`: define el servicio `stock-c-api` como Web Service Node,
  build/start commands apuntando al workspace correcto dentro del
  monorepo, health check en `/health`, plan `free`.
- `vercel.json`: build command con `turbo --filter=@stock-c/web`, output en
  `apps/web/dist`.
- `.github/workflows/ci.yml`: en cada push/PR corre `lint` → `typecheck` →
  `build` de todo el monorepo — así un PR roto no llega a mergearse, y
  Vercel/Render solo despliegan lo que ya pasó CI (a completar en Fase 15
  con el gate real).

**Falta (fuera de alcance de esta fase, no bloquea):**
- Crear las cuentas/proyectos reales en Vercel, Render, MongoDB Atlas y
  Upstash, y conectar el repositorio de GitHub — se hace cuando el usuario
  decida subir el código (esta fase deja todo listo para que ese paso sea
  mecánico, no de diseño).
- Completar a mano en cada dashboard los secretos que `render.yaml` deja
  marcados como `sync: false` (no pueden vivir en el repo).

## 8. Seguridad de esta fase

- Ningún secreto real en el repositorio — solo placeholders en
  `.env.example` y `sync: false`/`generateValue: true` en `render.yaml`.
- CORS del API restringido por variable de entorno, nunca `origin: "*"`.
- `.gitignore` cubre `.env*`, `node_modules`, `dist`, `.turbo`.

## 9. Verificación realizada

```
pnpm install    → OK (232 paquetes, sin vulnerabilidades bloqueantes)
pnpm lint       → OK (5 paquetes)
pnpm typecheck  → OK (5 paquetes, strict mode)
pnpm build      → OK (web: bundle de 143KB / 46KB gzip; api: compila a dist/)
node apps/api/dist/server.js → OK, GET /health devuelve 200
```

## 10. Revisión

**Terminado:** monorepo funcional de punta a punta, listo para desarrollar
sobre él; configuración de despliegue para Vercel + Render + Atlas +
Upstash como código versionado; CI en GitHub Actions; repositorio git
local inicializado con el primer commit.

**Falta:** crear las cuentas/proyectos reales en cada plataforma y conectar
el repo a GitHub (acción del usuario, cuando decida subirlo — no se hizo
push a ningún remoto en esta fase); completar secretos reales en los
dashboards.

**Podría mejorarse:** nada bloqueante. Cuando se defina un dominio propio
(Fase 15), se agrega como variable adicional de `CORS_ORIGIN` y en la
config de dominio de Vercel.
