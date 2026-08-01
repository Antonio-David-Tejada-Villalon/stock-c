# Fase 2 — Diseño UI/UX Completo

Estado: **borrador para aprobación**. No se ha escrito código de producción.
Mockup visual conceptual (interactivo, con toggle de tema real):
https://claude.ai/code/artifact/e0512e7b-ecfc-42c0-aaf0-cc94454fa12f

Este documento es la especificación escrita del sistema de diseño mostrado
en el mockup. Todo lo que sigue son *tokens* y decisiones — no hay
componentes de React todavía, eso se implementa recién en Fase 4 en
adelante, sobre esta especificación.

---

## 1. Sistema de diseño — filosofía

- Interfaz densa pero respirable: prioriza que un operador de almacén vea
  más información útil por pantalla (no cards gigantes ni hero sections),
  sin sacrificar jerarquía visual.
- Un solo color de acento con función de marca/interacción. Los colores
  semánticos (éxito/alerta/error) son un sistema aparte — nunca se usa el
  acento para comunicar estado, ni un color semántico para decorar.
- Todo token vive en variables CSS (`:root`), nunca valores sueltos en
  componentes — esto es lo que permite dark mode real y theming futuro
  (marca blanca por tenant, si algún día se aprueba).

## 2. Paleta

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `--accent` | Marca, CTA primario, foco, enlaces | `#4453F0` | `#6C7BFF` |
| `--accent-hover` | Hover de CTA primario | `#3641D6` | `#8492FF` |
| `--accent-wash` | Fondo sutil (selección, badges neutros de marca) | `#EEF0FF` | `#1B1E3A` |
| `--success` | Estado positivo (en stock, sincronizado) | `#1C9A6C` | `#33C08B` |
| `--warning` | Estado de atención (stock bajo, pendiente) | `#B7791F` | `#E0A73B` |
| `--danger` | Estado crítico (agotado, error) | `#D6423C` | `#F0645F` |
| `--bg` | Fondo de la app | `#F8F8FB` | `#0F1013` |
| `--bg-raised` | Superficies (cards, inputs, tabla) | `#FFFFFF` | `#17181D` |
| `--bg-sunken` | Fondos hundidos (sidebar, filas hover) | `#F1F1F6` | `#0B0C0F` |
| `--border` / `--border-strong` | Divisores / bordes de controles | `#E3E3EC` / `#C7C7D6` | `#262832` / `#34364A` |
| `--text` / `--text-secondary` / `--text-tertiary` | Jerarquía de texto | `#14161A` / `#53566B` / `#8A8DA1` | `#F1F1F5` / `#A6A9BC` / `#6F7286` |

Todos los pares texto/fondo cumplen ≥4.5:1 (texto) y ≥3:1 (bordes de
controles/foco) en ambos temas — verificado en el mockup, sección
"Accesibilidad".

## 3. Tipografía

- **UI:** pila de fuente nativa del sistema operativo
  (`-apple-system, "Segoe UI Variable", "Segoe UI", Roboto, ...`). Decisión
  deliberada, no un placeholder: es exactamente lo que usan Linear, Vercel
  y GitHub como base — carga instantánea, sin flash de fuente sin estilo,
  y look nativo en cada plataforma.
- **Datos/monoespaciada:** `ui-monospace, "JetBrains Mono", Menlo, Consolas`
  con `font-variant-numeric: tabular-nums` para SKUs, cantidades y precios
  en tablas — así las columnas numéricas alinean dígito a dígito.

Escala (tamaño/interlineado/peso):

| Rol | Tamaño | Interlineado | Peso | Uso |
|---|---|---|---|---|
| Display | 32px | 40px | 650 | Título de página poco frecuente |
| H1 | 24px | 32px | 600 | Título de página |
| H2 | 18px | 26px | 600 | Título de sección |
| H3 | 15px | 22px | 600 | Encabezado de card/tabla |
| Body | 14px | 20px | 400 | Texto de interfaz por defecto |
| Small | 13px | 18px | 400 | Texto secundario, celdas de tabla |
| Caption | 12px | 16px | 600 (mayúsculas, +4% tracking) | Etiquetas, timestamps |

## 4. Espaciado, radios y elevación

- Escala base 4px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Layout siempre con `flex`/`grid` + `gap` — nunca márgenes por elemento
  (evita colapsos/duplicados de espaciado al mover componentes).
- Radios: `6px` (controles pequeños: badges, botones sm), `8px` (inputs,
  botones, filas de menú), `12px` (cards, modales, paneles), `full`
  (pills, avatares, switches).
- Elevación mínima: casi todo se resuelve con borde de 1px; sombra sutil
  solo en elementos flotantes (modal, popover, toast, paleta de comandos).

## 5. Movimiento

- Duración: `120ms` para micro-interacciones (hover, toggle), `190ms` para
  apertura de paneles/menús. Siempre `ease-out` (`cubic-bezier(.2,.7,.3,1)`).
- Ninguna animación es puramente decorativa — todas confirman una acción o
  un cambio de estado.
- `prefers-reduced-motion: reduce` desactiva duraciones/animaciones en toda
  la interfaz (implementado a nivel global, no por componente).

## 6. Modo claro / oscuro

- Tokens definidos como variables CSS en `:root`; el tema del sistema
  operativo se respeta vía `@media (prefers-color-scheme: dark)`
  redefiniendo los mismos tokens (nunca estilos sueltos dentro del media
  query).
- El usuario puede forzar tema explícito, guardado en preferencia de
  cuenta/`localStorage`, aplicado con `[data-theme="dark"]` /
  `[data-theme="light"]` en la raíz, que siempre gana sobre la preferencia
  del sistema.
- El modo oscuro no es una simple inversión: los colores semánticos y el
  acento se reajustan para mantener el mismo contraste percibido (ver
  tabla de paleta).

## 7. Accesibilidad — WCAG 2.2 AA

- Contraste: ≥4.5:1 texto normal, ≥3:1 texto grande y componentes de UI —
  verificado para cada par de la paleta en ambos temas.
- Foco visible en todo elemento interactivo (`:focus-visible`, anillo de
  2px del color de acento, nunca solo `outline: none`).
- El color nunca es el único portador de significado: todo badge de estado
  lleva texto + un indicador de forma (punto), nunca solo un color de
  fondo.
- Navegación 100% por teclado: tab order lógico, `Escape` cierra
  modal/paleta de comandos, foco se devuelve al elemento que abrió el
  overlay al cerrarlo (evita que el foco se "pierda").
- Roles/ARIA: `role="dialog"` + `aria-modal` en modales y paleta de
  comandos, `aria-label` en botones de solo ícono, regiones vivas
  (`aria-live="polite"`) para toasts.
- Objetivo táctil mínimo 24×24px en controles interactivos (checkboxes,
  switches, íconos de acción en tabla).

## 8. Flujo de navegación

```
Login ──(autenticado)──> Panel (Dashboard)
                             │
        ┌────────────────────┼──────────────────────┐
        │                    │                       │
   Productos            Movimientos               Reportes
        │                    │                       │
   Detalle/Editar      Detalle de movimiento    (definido en Fase 11)
        │
   Nuevo producto (formulario)

Todas las secciones comparten el shell: Sidebar (navegación + selector
empresa/sucursal) + Topbar (búsqueda, paleta de comandos ⌘K, usuario).
```

- El selector de empresa/sucursal vive fijo arriba del sidebar — cambiar de
  contexto (multiempresa/multisucursal) nunca obliga a salir de la pantalla
  actual.
- La paleta de comandos (`⌘K` / `Ctrl+K`) es el atajo transversal para
  crear producto, registrar movimiento, ir a una sección o cambiar de
  sucursal sin usar el mouse — inspirado en Linear/Raycast, coherente con
  el uso denso que va a tener un operador de almacén.

## 9. Componentes (inventario base)

Botón (primario/secundario/ghost/danger × sm/md), campo de texto/select con
estados normal/error/éxito, switch, checkbox, radio, badge de estado
(éxito/alerta/error/neutro), avatar, pestañas, tooltip, menú desplegable,
tabla con encabezado fijo y paginación, card, modal/drawer, toast, estado
vacío, skeleton loader, `kbd` (atajo de teclado), paleta de comandos.

Cada uno usa exclusivamente los tokens de las secciones 2-5 — ninguno
declara color, tamaño o radio propio. Ver el mockup para el detalle visual
de cada estado.

## 10. Pantallas cubiertas en esta fase

1. **Login** — layout centrado, sin sidebar, un solo CTA primario.
2. **Dashboard + Sidebar** — shell completo: sidebar con selector de
   empresa/sucursal y navegación, topbar con búsqueda, KPIs y tabla de
   movimientos recientes.
3. **Tabla de productos** — encabezado fijo, columnas numéricas alineadas
   con tipografía monoespaciada, badges de estado, paginación.
4. **Formulario** — alta de producto, agrupado por lógica, validación
   inline, ancho controlado.

Wireframes visuales de las cuatro en el mockup interactivo (link arriba,
sección "Pantallas").

## 11. Responsive

- Breakpoint principal: `860px`. Por debajo, el sidebar deja de ser una
  columna fija y pasa a ser un panel deslizable (drawer) activado desde la
  topbar.
- Tablas anchas usan scroll horizontal contenido en su propio contenedor
  (`overflow-x: auto`) — el body de la página nunca scrollea lateralmente.
- KPIs pasan de fila de 3 columnas a apiladas en una sola columna en
  pantallas angostas.

---

## Resumen — qué cubre este documento

- Sistema de diseño completo: paleta (con valores hex para ambos temas),
  tipografía, espaciado, radios, movimiento, accesibilidad.
- Flujo de navegación de alto nivel.
- Mockups conceptuales de las 4 pantallas pedidas (Login, Dashboard+Sidebar,
  Tabla, Formulario), navegables e interactivos, con modo claro/oscuro real.
- Inventario de componentes base para las fases siguientes.

## Qué falta / se resuelve en fases posteriores

- Implementación real de los componentes como código React (Fase 4 en
  adelante, sobre `packages/ui`).
- Pantallas adicionales (Categorías/Marcas/Unidades, Kardex, Reportes,
  Notificaciones) se diseñan en su propia fase, no aquí.
- Copys finales de error/vacío/confirmación en español neutro, revisados
  con más detalle cuando se implemente cada flujo real (los del mockup son
  representativos, no definitivos).

## Qué podría mejorarse

- Nada bloqueante identificado. Posible mejora futura (no bloquea esta
  fase): agregar un modo de alto contraste adicional a claro/oscuro si un
  cliente lo pide explícitamente — no se construye sin aprobación.
