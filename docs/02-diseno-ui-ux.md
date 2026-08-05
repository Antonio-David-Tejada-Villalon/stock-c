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

---

## Adenda — Refresh de marca (2026-08-05)

El usuario proveyó una guía de marca real (archivada en
[docs/assets/stockc-brand-guidelines.webp](assets/stockc-brand-guidelines.webp)
para referencia futura: isotipo hexagonal "C", paleta Naranja/Azul/
Esmeralda, tipografía Inter+Manrope) y pidió aplicarla al sistema de
diseño de esta fase. Cambios, con la razón de cada uno:

- **`--accent` pasa de índigo (`#4453F0`/`#6C7BFF`) a Electric Blue
  (`#2663EB` claro / `#5B8DF5` oscuro).** La sección 1 de este documento
  fija que hay **un solo** acento con función de marca+interacción — el
  Naranja de marca (`#FF6B00`) no puede cumplir ese doble rol porque texto
  blanco sobre él da ~2.86:1, por debajo del mínimo WCAG 2.2 AA (§7) tanto
  para texto (4.5:1) como para componentes de UI (3:1). Electric Blue sí
  pasa (~5.16:1 claro, ~6.54:1 oscuro) y es un color de marca legítimo (la
  guía lo incluye como variante oficial del app icon), así que asume el rol
  único de `--accent` sin contradecir la regla de "un solo acento".
- **Naranja de marca (`#FF6B00`) se agrega como `--brand-mark`, un token
  aparte, no como `--accent`.** Uso exclusivo: el isotipo/app icon (ver
  `packages/ui/src/Logo.tsx`), donde las reglas de contraste de texto no
  aplican. Nunca se usa en botones, links, badges ni ningún elemento de UI
  que porte texto.
- **`--success`/`--warning`/`--danger` sin cambios.** La sección 1 ya
  declara los colores semánticos como "un sistema aparte" del acento/marca
  — no tienen por qué igualar el Esmeralda/etc. del deck de marca, y ya
  están verificados en AA.
- **Tipografía:** pasa de la pila nativa del SO (decisión original de esta
  sección) a **Manrope autohospedada** (`--font-ui`, cuerpo/UI por
  defecto) + **Inter autohospedada** (`--font-heading`, nuevo token —
  headings, botones vía `packages/ui/src/Button.tsx`, marca). Autohospedada
  vía `@fontsource` (paquete npm, sin CDN externo) para no romper el
  principio offline-first de Fase 10 — un `<link>` a Google Fonts fallaría
  sin red. Este es un cambio de arquitectura real, no solo estético (bytes
  adicionales, riesgo de flash de fuente en la primera carga) — confirmado
  explícitamente por el usuario antes de aplicarlo, sabiendo que reemplaza
  una decisión ya razonada y aprobada.
- **Isotipo nuevo:** `packages/ui/src/Logo.tsx` (`LogoMark` + `Logo`) — un
  hexágono en trazo abierto hacia la derecha, recreado en SVG a partir de
  la imagen de referencia (no había un vector original entregado). Usado
  en el sidebar (`AppShell.tsx`, reemplaza el placeholder "S" + texto
  plano) y como favicon (`apps/web/public/favicon.svg`).
- **Favicon + PWA manifest:** `index.html` suma `<link rel="icon">` (SVG) y
  `theme-color`; el manifest de `vite-plugin-pwa` (`vite.config.ts`) ahora
  usa el nombre/colores de marca. **No se generaron íconos PNG
  multi-resolución** (192/512/maskable/apple-touch-icon) — la
  "instalabilidad" PWA completa ya quedaba fuera de alcance en Fase 10
  (`docs/10-offline-first.md`), y un favicon SVG cubre navegadores
  modernos de escritorio/Android; iOS (que sí requiere PNG para "Agregar a
  inicio") queda como mejora futura si se retoma la instalabilidad.
- **Espaciado/radios/movimiento (secciones 4-5):** sin cambios — la guía de
  marca no los toca y ya coinciden (grid de 8px).
- **Cobertura de `--font-heading`:** aplicado a nivel de token y en
  `Button.tsx` (todos los CTA del producto quedan en Inter con un solo
  archivo) y en el wordmark del `Logo`. **No se retocó cada heading
  (`h1`/`h2`) de cada pantalla individualmente** — ese es un barrido
  mecánico más grande, deliberadamente fuera de esta adenda; queda
  disponible como clase `font-heading` de Tailwind para aplicarse
  screen-by-screen si se pide.
- **Toggle de tema claro/oscuro — implementación real del diseño ya
  especificado en la sección 6** (nunca se había construido: solo existían
  los tokens `[data-theme="dark"/"light"]` sin ningún control de UI ni
  persistencia). `apps/web/src/theme/ThemeContext.tsx` guarda la elección
  explícita en `localStorage` (gana siempre sobre el sistema, tal como
  dice §6); sin elección explícita, sigue `prefers-color-scheme` en vivo.
  Un script inline en `index.html` aplica el tema guardado antes del
  primer paint para evitar el flash claro→oscuro. Botón de solo ícono
  (`packages/ui/src/ThemeToggle.tsx`, sol/luna en SVG, `aria-label` por
  §7) en la topbar, junto al badge de sincronización.
