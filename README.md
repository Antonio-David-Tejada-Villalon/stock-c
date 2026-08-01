# STOCK-C

Plataforma empresarial de gestión de inventario (base para un ERP), MERN,
offline-first, multiempresa y multisucursal. Ver [CLAUDE.md](CLAUDE.md) para
el modo de trabajo por fases y [docs/](docs/) para cada entregable de fase.

## Stack

- **Frontend** (`apps/web`): React + TypeScript + Vite → desplegado en **Vercel**.
- **Backend** (`apps/api`): Fastify + TypeScript → desplegado en **Render**.
- **Base de datos**: MongoDB → **MongoDB Atlas**.
- **Cache/colas**: Redis (Valkey en local) → Upstash en producción.
- Monorepo con **pnpm workspaces** + **Turborepo**.

## Requisitos

- Node.js ≥ 22
- pnpm (`npm install -g pnpm` si no lo tenés)
- Docker (para Mongo/Redis en local) — opcional si usás Atlas/Upstash
  también en desarrollo.

## Empezar

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env

# levantar Mongo (replica set) + Redis en local
docker compose up -d

pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/health

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Corre todas las apps en modo desarrollo |
| `pnpm build` | Build de producción de todas las apps |
| `pnpm lint` | ESLint en todo el monorepo |
| `pnpm typecheck` | TypeScript sin emitir, en todo el monorepo |
| `pnpm format` | Prettier sobre todo el repo |

Detalle completo de la configuración del proyecto y del despliegue en
[docs/04-configuracion-proyecto.md](docs/04-configuracion-proyecto.md).
