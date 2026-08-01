# Fase 1 — Arquitectura Completa del Proyecto

Estado: **✅ aprobado** (2026-08-01). No se ha escrito código. Este documento
cubre las 10 arquitecturas pedidas: lógica, física, frontend, backend,
offline, sincronización, seguridad, permisos, despliegue y backups.

Las 4 decisiones de mayor impacto en la escalabilidad futura fueron
confirmadas por el usuario, todas según la recomendación:

1. Monolito modular (no microservicios desde el inicio).
2. Multiempresa: base de datos compartida + `tenantId` forzado en la capa
   de repositorio (no base de datos por tenant).
3. Backend: Fastify (no NestJS ni Express).
4. Sincronización offline: híbrido — log de eventos append-only para
   movimientos de stock + Last-Write-Wins con resolución manual para datos
   maestros mutables (no LWW puro).

---

## 1. Arquitectura lógica

Patrón general: **monolito modular** organizado por dominios de negocio, no
por capas técnicas. Cada módulo (`identity`, `catalog`, `inventory`, y en el
futuro `sales`, `purchases`, `pos`, ...) es una unidad autocontenida:

```
routes (validación + auth)
   -> controllers (orquestación, sin lógica de negocio)
      -> services (reglas de negocio del dominio)
         -> repositories (acceso a datos, Mongoose)
            -> modelos de dominio
```

Comunicación entre módulos: nunca importando el repositorio de otro módulo
directamente. Se comunican por su capa de `service` pública o por un **bus de
eventos interno** (in-process ahora; intercambiable por NATS/RabbitMQ más
adelante sin tocar lógica de negocio). Esto es lo que permite, el día que
haga falta, extraer un módulo a un servicio independiente sin reescribirlo.

**✅ DECISIÓN 1 (confirmada) — Monolito modular**

- **Elegido: monolito modular** con límites de módulo forzados por
  estructura de carpetas + linting de dependencias (p. ej.
  `dependency-cruiser`), y bus de eventos interno reemplazable.
  - Ventajas: velocidad de iteración alta (un solo deploy, sin
    transacciones distribuidas), coherencia fuerte para operaciones que
    necesitan consistencia inmediata (conteo de stock), costo de
    infraestructura bajo a la escala de "miles de usuarios".
  - Desventajas: escalado es de todo el proceso, no por módulo (mitigable
    horizontalmente porque el API es stateless).
- **Alternativa: microservicios desde el día 1.**
  - Ventajas: escalado y despliegue independiente por módulo, libertad
    tecnológica por servicio.
  - Desventajas: complejidad operativa altísima y prematura (descubrimiento
    de servicios, transacciones distribuidas, latencia de red), especialmente
    riesgoso para inventario, donde la consistencia del stock es crítica.
    Ralentiza mucho las fases 5-9.

---

## 2. Arquitectura física (topología)

```
[Browser SPA / PWA] --TLS--> [Reverse Proxy / LB]
                                   |
                          [API Node.js (stateless, N réplicas)]
                             |         |            |
                        [MongoDB   [Redis:      [Workers en cola
                         Replica    cache,        (BullMQ) para
                         Set]       sesiones,     sync, reportes,
                                    rate limit,    notificaciones]
                                    pub/sub]
                                   |
                          [Object storage S3-compatible
                           (imágenes, adjuntos)]
```

- API sin estado en memoria (sesiones/refresh tokens en Redis) → escala
  horizontalmente agregando réplicas detrás del load balancer.
- MongoDB en replica set (mínimo 3 nodos) desde el principio por alta
  disponibilidad; sharding queda como camino disponible, no activado aún.
- Workers separados del proceso API para todo trabajo que no deba bloquear
  una respuesta HTTP (reconciliación de sincronización offline, generación
  de reportes, notificaciones).

---

## 3. Arquitectura de frontend

- **React + TypeScript + Vite.**
- Estructura por *feature*, no por tipo de archivo:
  `/features/products/{components,hooks,api,store}`, igual para
  `inventory`, `auth`, etc. Evita el "archivo gigante" y hace que cada
  módulo de negocio sea autocontenido también en el cliente.
- **Estado de servidor:** TanStack Query (React Query) — separa
  explícitamente "datos que vienen del servidor" de "estado de UI local",
  con caché, revalidación y reintentos ya resueltos.
- **Estado de UI local:** Zustand (ligero, sin el boilerplate de Redux),
  suficiente para un dashboard tipo Linear/Notion.
- **Sistema de diseño:** Tailwind CSS + Radix UI (primitivas accesibles sin
  estilos) + `class-variance-authority` para variantes — es la combinación
  que permite lograr la estética minimalista pedida (Linear/Vercel/Supabase)
  cumpliendo WCAG 2.2 AA sin reinventar accesibilidad a mano. Se diseña en
  detalle en la Fase 2.
- **Monorepo:** pnpm workspaces + Turborepo — `apps/web`, `apps/api`,
  `packages/ui` (design system), `packages/shared-types` (tipos TypeScript
  compartidos entre frontend y backend, generados desde los esquemas de
  validación del backend). Esto evita que frontend y backend se desincronicen
  a medida que el ERP crece a decenas de entidades.

---

## 4. Arquitectura de backend

- **Node.js + TypeScript.**

**✅ DECISIÓN 2 (confirmada) — Framework de backend: Fastify**

- **Elegido: Fastify.** Mejor rendimiento que Express a la escala de
  "miles de usuarios", validación de esquema integrada (TypeBox/JSON
  Schema) que además genera documentación OpenAPI gratis, y un modelo de
  plugins/encapsulación que mapea muy bien a los límites de módulo del
  monolito modular.
- **Alternativa: NestJS.** Ventajas: estructura muy opinionada, inyección de
  dependencias, gran ecosistema, curva de entrada suave si el equipo viene
  de Angular. Desventajas: más "magia" (decoradores, metadata reflection),
  más pesado, menor rendimiento crudo que Fastify.
- **Alternativa: Express.** Ventajas: el más simple y conocido, más
  ejemplos disponibles. Desventajas: no trae validación ni estructura —
  hay que construir a mano lo que Fastify/NestJS dan por defecto,
  aumentando el riesgo de inconsistencia entre módulos con 15 fases por
  delante.

**✅ DECISIÓN 3 (confirmada) — Estrategia de aislamiento multiempresa**

- **Elegido: base de datos compartida + `tenantId` obligatorio**, con
  el filtro de tenant forzado estructuralmente en la capa de repositorio
  (un plugin de Mongoose que inyecta `tenantId` automáticamente en cada
  query, imposible de saltarse por accidente) y todos los índices
  compuestos empezando por `tenantId`.
  - Ventajas: operación simple (una sola base para backupear, monitorear y
    migrar), costo bajo a esta escala, permite analítica cruzada futura si
    hace falta.
  - Desventajas: exige disciplina — un bug en el filtro de tenant podría
    filtrar datos entre empresas. Se mitiga forzándolo en el repositorio,
    nunca en queries ad-hoc.
- **Alternativa: base de datos (o schema) por tenant.**
  - Ventajas: aislamiento físico fuerte, backup/restore/exportación por
    cliente trivial, fácil "borrar" un tenant completo.
  - Desventajas: pesadilla operativa a escala (pool de conexiones por
    tenant, migraciones que corren N veces, reportes cruzados difíciles,
    costo de infraestructura que escala con la cantidad de clientes, no
    con el uso real).
  - Se deja como "vía de escape" disponible para un futuro cliente
    enterprise que exija aislamiento físico, sin comprometernos a eso desde
    el día 1.

Multisucursal: `Branch` es una entidad hija de `Company`. El stock se
trackea por `companyId + branchId`; los roles de usuario se asignan por
empresa y, opcionalmente, restringidos a un subconjunto de sucursales.

---

## 5. Arquitectura offline

- **Dexie** (wrapper de IndexedDB) como almacén local, fuente de verdad del
  cliente mientras no hay red.
- **Patrón outbox:** toda escritura se guarda primero en una cola local de
  "operaciones pendientes", se aplica de forma optimista a la UI, y luego
  se sincroniza contra el servidor cuando hay conexión.
- **Service Worker (Workbox)** para cacheo de assets y registro de
  Background Sync.
- La app debe ser completamente usable offline para lectura y escritura en
  cola; el servidor es la fuente de verdad una vez reconciliado.

---

## 6. Arquitectura de sincronización

**✅ DECISIÓN 4 (confirmada) — Estrategia de resolución de conflictos (la más
riesgosa de las cuatro: un error aquí corrompe el conteo de stock)**

- **Opción A — Last-Write-Wins (LWW)** con `version`/`updatedAt` y
  concurrencia optimista (HTTP 409 si la versión no coincide).
  - Suficiente para datos maestros editables (nombre de producto,
    categoría).
  - **Insuficiente y peligroso para cantidades de stock**: perder
    silenciosamente un movimiento concurrente es un bug de negocio real,
    no solo técnico.
- **Opción B — Log de eventos append-only para todo lo relacionado a
  cantidades** (los movimientos de kardex nunca se editan, solo se agregan;
  el stock actual = suma de movimientos). Un conflicto de concurrencia deja
  de ser posible por diseño en esta parte del sistema.
- **Elegido: híbrido.** Log de eventos append-only (Opción B) para
  todo lo que sea cantidad/movimiento — es además la forma contable
  correcta de llevar un kardex, independientemente del tema offline — y
  LWW con verificación de versión + UI de "resolver conflicto" (Opción A)
  solo para datos maestros mutables editados offline en dos dispositivos.

Protocolo de sync: *delta sync* por cursor (`updatedAt`/`syncVersion`) por
colección y tenant — el cliente pide "cambios desde mi último cursor", el
servidor asigna número de secuencia autoritativo a cada movimiento.

---

## 7. Arquitectura de seguridad

- **AuthN:** JWT de acceso de corta duración (15 min) + refresh token en
  cookie httpOnly/secure, rotado en cada uso, revocable (lista de
  revocación en Redis).
- **AuthZ:** RBAC con alcance por empresa + sucursal (detalle en sección 8).
- **Transporte:** TLS en todos los tramos, HSTS.
- **En reposo:** cifrado en reposo de MongoDB, secretos en un gestor de
  secretos (nunca `.env` en el repo) — herramienta concreta se decide en
  Fase 4/15.
- **Validación de entrada:** esquema de validación en el borde (TypeBox/Zod)
  en cada endpoint, antes de tocar lógica de negocio.
- **Rate limiting** y protección de fuerza bruta en endpoints de auth
  (respaldado por Redis).
- **Auditoría:** colección append-only registrando quién/cuándo/qué en toda
  acción que muta datos — crítico en inventario ("quién cambió este stock y
  cuándo").
- **OWASP:** cabeceras de seguridad (helmet), protección CSRF en flujos con
  cookies, queries a Mongo siempre parametrizadas (nunca concatenación),
  escaneo de dependencias (Dependabot/Snyk) como política, ejecutado en
  Fase 4/14.
- El aislamiento de tenant (sección 4) **es** un límite de seguridad, no
  solo una decisión de arquitectura de datos.

---

## 8. Arquitectura de permisos

- Modelo RBAC granular: `Role -> Permissions` (p. ej.
  `inventory:movement:create`, `product:update`), con asignación de rol por
  `Company` y, opcionalmente, restringida a un subconjunto de `Branch`.
- Roles iniciales: Owner, Admin, Operador de almacén, Visor — pero el
  modelo de permisos vive en base de datos, no hardcodeado en un enum, para
  que futuros módulos (ventas, POS...) registren nuevos permisos sin tocar
  el núcleo de auth.
- Super-admin (nuestro propio equipo de operaciones, a nivel plataforma) es
  un concepto separado de los roles de un tenant — nunca se mezclan.

---

## 9. Arquitectura de despliegue

**✅ DECISIÓN 5 (confirmada, 2026-08-01) — Modelo de costo de infraestructura:
gratis para desarrollar, pago solo si el producto crece.**

Todo el *software* usado en el stack (React, Fastify, MongoDB Community,
Redis/Valkey, MinIO, Docker, Nginx) es 100% gratuito y open source, sin
costo sin importar la escala. Lo que sí tiene costo eventual es la
*infraestructura gestionada* (hosting, base de datos gestionada, object
storage en la nube) una vez que el uso real supere los tiers gratuitos —
esto es inevitable para cualquier producto con miles de usuarios reales, y
no depende de qué stack se elija. Durante desarrollo y validación temprana
se usan exclusivamente tiers gratuitos ($0):

- MongoDB Atlas M0 (free forever, cluster compartido) para dev/staging.
- Hosting frontend en un proveedor con capa gratuita (Vercel/Netlify/Cloudflare
  Pages) — Fase 15 define el proveedor concreto.
- Backend en un proveedor con capa gratuita (Railway/Render/Fly.io) para
  dev/staging.
- TLS gratis siempre (Let's Encrypt), sin importar la fase.

Nota: si se prefiere evitar cualquier ambigüedad de licenciamiento futuro
en Redis (cambió a licencia source-available en 2024), la alternativa
directa y 100% BSD es **Valkey** (fork mantenido por la Linux Foundation,
compatible como reemplazo directo) — decisión concreta se toma en Fase 4.

- Todo containerizado en local (Docker Compose): frontend y API y workers
  como contenedores separados en desarrollo.
- MongoDB gestionado (Atlas) recomendado sobre auto-hospedado para empezar
  — a este tamaño de equipo, el trabajo operativo de mantener un replica
  set seguro y con HA no se justifica todavía; se revisita en Fase 15 si el
  costo lo amerita. En dev/staging se usa el tier gratuito M0; el paso a un
  tier pago se evalúa solo cuando el uso real lo exija.
- Entornos: local (docker-compose) → staging → producción, promovidos por
  CI/CD (pipeline concreto se construye en Fase 4/15).
- Escalado horizontal: el API es stateless, así que escala agregando
  réplicas detrás del load balancer.

**Actualización (Fase 4, 2026-08-01) — proveedores concretos elegidos por
el usuario:** GitHub (repositorio y disparador de CI/CD) → **Vercel**
(frontend, `apps/web`, despliegue estático + preview deployments por PR) +
**Render** (backend, `apps/api`, Web Service) + **MongoDB Atlas** (base de
datos, tier M0 gratuito para empezar). Redis se resuelve con un proveedor
serverless (Upstash, tier gratuito) en vez de un Redis propio en Render,
para no pagar por un servicio siempre encendido antes de necesitarlo —
detalle completo en
[04-configuracion-proyecto.md](04-configuracion-proyecto.md). Esto
reemplaza la ambigüedad "a definir en Fase 15" de la versión original de
este documento; el resto de la arquitectura de despliegue (contenedores en
local, API stateless, entornos) no cambia.

---

## 10. Arquitectura de backups

- MongoDB: backups continuos point-in-time (PITR de Atlas, o `mongodump` +
  oplog si se auto-hospeda), política de retención (p. ej. 30 días rolling
  + archivo mensual).
- Exportación por tenant (JSON/CSV) — útil como feature de producto a
  futuro y como práctica operativa desde ya.
- Object storage con versionado de bucket habilitado.
- Simulacros de restauración programados como práctica real, no teórica —
  se agenda como política operativa en Fase 15.

---

## Resumen — qué cubre este documento

- Las 10 arquitecturas pedidas están definidas a nivel de decisión y
  justificación, sin código.
- Las 4 decisiones de alto impacto fueron confirmadas por el usuario
  (2026-08-01), todas según la recomendación del arquitecto.

## Qué falta / se decide en fases posteriores

- Diagramas de wireframes y sistema de diseño visual → Fase 2.
- Esquema exacto de colecciones, índices y validaciones → Fase 3.
- Elección concreta de gestor de secretos, proveedor de hosting y pipeline
  de CI/CD → Fase 4/15.
- Todo lo relacionado a módulos futuros (ventas, POS, facturación, etc.) no
  se diseña todavía, solo se dejó el bus de eventos y el monolito modular
  preparados para no bloquear esa extensión el día que se apruebe.
