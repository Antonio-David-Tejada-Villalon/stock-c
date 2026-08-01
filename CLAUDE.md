# STOCK-C — Plataforma Empresarial de Gestión de Inventario (base ERP)

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
| 4 | Configuración del proyecto (repo, carpetas, linting, Docker, envs) | 🔵 en revisión |
| 5 | Autenticación (JWT, refresh, roles, permisos, sesiones) | ⚪ pendiente |
| 6 | Dashboard principal | ⚪ pendiente |
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
