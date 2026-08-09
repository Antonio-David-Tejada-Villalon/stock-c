import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, FormField, Input, ThemeToggle } from "@stock-c/ui";
import { PERMISSIONS, type Company } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { ApiAuthError } from "../auth/api";
import { getCompany, updateCompany } from "./api";
import { bestTextColor, passesAA } from "../../lib/contrast";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_ACCENT = "#2663EB";

// Todos verificados >= 4.5:1 de contraste (blanco o casi-negro, lo que
// dé mejor ratio) antes de curarlos — ver docs/13, "Apariencia". Un preset
// que falla WCAG confundiría más de lo que ayuda.
const PALETTE_GROUPS: { label: string; colors: { name: string; hex: string }[] }[] = [
  {
    label: "Azules",
    colors: [
      { name: "Azul eléctrico", hex: "#2663EB" },
      { name: "Índigo", hex: "#4F46E5" },
      { name: "Azul cielo", hex: "#0284C7" },
      { name: "Cian", hex: "#0891B2" },
    ],
  },
  {
    label: "Verdes",
    colors: [
      { name: "Esmeralda", hex: "#059669" },
      { name: "Verde bosque", hex: "#15803D" },
      { name: "Lima", hex: "#65A30D" },
      { name: "Teal", hex: "#0D9488" },
    ],
  },
  {
    label: "Cálidos",
    colors: [
      { name: "Rojo", hex: "#DC2626" },
      { name: "Naranja", hex: "#D97706" },
      { name: "Ámbar", hex: "#B45309" },
      { name: "Marrón", hex: "#92400E" },
    ],
  },
  {
    label: "Púrpuras y neutros",
    colors: [
      { name: "Violeta", hex: "#7C3AED" },
      { name: "Fucsia", hex: "#C026D3" },
      { name: "Rosa", hex: "#DB2777" },
      { name: "Pizarra", hex: "#475569" },
    ],
  },
];

function applyAccentToDocument(accentColor?: string) {
  const root = document.documentElement;
  if (accentColor) {
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--accent-contrast", bestTextColor(accentColor));
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-contrast");
  }
}

export function AparienciaPanel() {
  const { theme, toggleTheme } = useTheme();
  const { accessToken, user } = useAuth();
  const canUpdate = (user?.role.permissions ?? []).includes(PERMISSIONS.COMPANY_UPDATE);

  const [company, setCompany] = useState<Company | null>(null);
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const res = await getCompany(accessToken);
    setCompany(res);
    setAccentColor(res.settings.accentColor ?? "");
    setLogoUrl(res.settings.logoUrl ?? "");
    setFaviconUrl(res.settings.faviconUrl ?? "");
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const contrast = accentColor && HEX_PATTERN.test(accentColor) ? passesAA(accentColor) : null;
  const previewHex = accentColor && HEX_PATTERN.test(accentColor) ? accentColor : DEFAULT_ACCENT;
  const previewText = bestTextColor(previewHex);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !company) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateCompany(accessToken, {
        version: company.version,
        settings: {
          accentColor: accentColor.trim() || null,
          logoUrl: logoUrl.trim() || null,
          faviconUrl: faviconUrl.trim() || null,
        },
      });
      setCompany(updated);
      setSaved(true);
      applyAccentToDocument(updated.settings.accentColor);
      const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (faviconLink) faviconLink.href = updated.settings.faviconUrl || "/favicon.svg";
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "invalid_contrast") {
        setError(err.message);
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setError("Los datos cambiaron desde que cargaste la página. Recargá y volvé a intentar.");
      } else {
        setError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">Tema</h3>
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="text-[13px] text-text-secondary">
            {theme === "dark" ? "Oscuro" : "Claro"} — también disponible en la barra superior.
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 border-t border-border pt-6">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text">Identidad de marca</h3>
          <FormField label="Logo (URL)" htmlFor="a-logo" helper="Sin subida de archivos — pegá una URL pública">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 w-8 flex-none rounded-md border border-border object-contain"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  onLoad={(e) => (e.currentTarget.style.visibility = "visible")}
                />
              )}
              <Input
                id="a-logo"
                type="url"
                disabled={!canUpdate}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.svg"
              />
            </div>
          </FormField>
          <FormField label="Favicon (URL)" htmlFor="a-favicon" helper="Ícono de la pestaña del navegador">
            <div className="flex items-center gap-3">
              {faviconUrl && (
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-8 w-8 flex-none rounded-md border border-border object-contain"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  onLoad={(e) => (e.currentTarget.style.visibility = "visible")}
                />
              )}
              <Input
                id="a-favicon"
                type="url"
                disabled={!canUpdate}
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://…/favicon.svg"
              />
            </div>
          </FormField>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Color de acento de la empresa</h3>
            {accentColor && (
              <button
                type="button"
                disabled={!canUpdate}
                onClick={() => setAccentColor("")}
                className="text-xs text-text-tertiary hover:text-danger"
              >
                Volver al default de Stock-C
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {PALETTE_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-3">
                <span className="w-32 flex-none text-[12px] text-text-tertiary">{group.label}</span>
                <div className="flex flex-wrap gap-2">
                  {group.colors.map((c) => {
                    const selected = accentColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        disabled={!canUpdate}
                        title={c.name}
                        onClick={() => setAccentColor(c.hex)}
                        className="h-7 w-7 rounded-full ring-offset-2 ring-offset-bg-raised transition"
                        style={{
                          backgroundColor: c.hex,
                          boxShadow: selected ? `0 0 0 2px ${c.hex}` : undefined,
                          outline: selected ? "2px solid var(--text)" : "1px solid var(--border-strong)",
                          outlineOffset: selected ? 2 : 0,
                        }}
                        aria-label={c.name}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <FormField label="Personalizado" htmlFor="a-color">
            <div className="flex items-center gap-3">
              <input
                id="a-color"
                type="color"
                disabled={!canUpdate}
                value={accentColor || DEFAULT_ACCENT}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-9 flex-none cursor-pointer rounded-md border border-border-strong bg-bg-raised p-0.5"
                aria-label="Elegir color de acento"
              />
              <Input
                value={accentColor}
                disabled={!canUpdate}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder={DEFAULT_ACCENT}
              />
            </div>
          </FormField>

          {contrast && (
            <p className={`text-xs ${contrast.ok ? "text-success" : "text-danger"}`}>
              Contraste {contrast.bestRatio.toFixed(2)}:1 {contrast.ok ? "— pasa WCAG AA" : "— no pasa WCAG AA (mínimo 4.5:1)"}
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-border bg-bg-sunken p-4">
            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Vista previa</span>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-md px-3 py-1.5 text-[13px] font-medium"
                style={{ backgroundColor: previewHex, color: previewText }}
              >
                Botón principal
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[12px] font-medium"
                style={{ backgroundColor: `${previewHex}1a`, color: previewHex }}
              >
                Insignia
              </span>
              <span className="text-[13px] font-medium underline" style={{ color: previewHex }}>
                Enlace de ejemplo
              </span>
            </div>
          </div>

          {canUpdate && (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar apariencia"}
              </Button>
              {saved && <span className="text-xs text-success">Guardado y aplicado.</span>}
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </form>
    </div>
  );
}
