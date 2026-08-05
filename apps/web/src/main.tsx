import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Manrope (cuerpo/UI) + Inter (headings/botones/nav) autohospedadas —
// ver docs/02-diseno-ui-ux.md, adenda de branding, y packages/ui/tokens.css.
// Solo subconjuntos latin/latin-ext (cubren español con acentos/ñ) — los
// imports sin subconjunto traen cirílico/griego/vietnamita también, que
// infla el precache de la PWA (Fase 10) sin necesidad.
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-ext-400.css";
import "@fontsource/manrope/latin-ext-500.css";
import "@fontsource/manrope/latin-ext-600.css";
import "@fontsource/manrope/latin-ext-700.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
