import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Precachea solo el shell de la app (JS/CSS/HTML) para que cargue sin
    // red — a propósito sin runtime caching de la API. Ver
    // docs/10-offline-first.md, sección 2: eso es trabajo de Dexie/el
    // motor de sync, no del Service Worker.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Stock-C — Connected Inventory",
        short_name: "Stock-C",
        theme_color: "#2663eb",
        background_color: "#111827",
        display: "standalone",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
