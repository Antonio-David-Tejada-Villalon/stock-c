import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { getCompany } from "../features/settings/api";
import { bestTextColor } from "../lib/contrast";

const DEFAULT_FAVICON = "/favicon.svg";

/**
 * Aplica el acento/logo/favicon de la empresa autenticada sobre `:root`
 * en runtime (Fase 13) — `tokens.css` sigue siendo el default de marca
 * de Stock-C para pantallas sin empresa cargada (login). Solo sobrescribe
 * `--accent`/`--accent-contrast`, no `--accent-hover`/`--accent-wash` —
 * ver docs/13, "Justificación técnica". Devuelve `logoUrl`/`companyName`
 * para que `AppShell` los use en el `Logo` y el `TenantSwitch` de la
 * sidebar — antes de esto, el nombre editado en la pestaña Empresa no
 * se reflejaba en ningún lugar visible del sistema.
 */
export function useCompanyBranding(): { logoUrl?: string; companyName?: string } {
  const { accessToken } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [companyName, setCompanyName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    if (!accessToken) {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-contrast");
      setLogoUrl(undefined);
      setCompanyName(undefined);
      return;
    }

    let cancelled = false;
    async function apply() {
      try {
        const company = await getCompany(accessToken!);
        if (cancelled) return;

        if (company.settings.accentColor) {
          root.style.setProperty("--accent", company.settings.accentColor);
          root.style.setProperty("--accent-contrast", bestTextColor(company.settings.accentColor));
        } else {
          root.style.removeProperty("--accent");
          root.style.removeProperty("--accent-contrast");
        }

        const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (faviconLink) faviconLink.href = company.settings.faviconUrl || DEFAULT_FAVICON;

        setLogoUrl(company.settings.logoUrl);
        setCompanyName(company.name);
      } catch {
        // Branding es cosmético — un fallo acá no debe bloquear la app.
      }
    }

    void apply();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return { logoUrl, companyName };
}
