import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, FormField, Input } from "@stock-c/ui";
import { PERMISSIONS, type Company } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { getCompany, updateCompany } from "./api";

interface FormState {
  name: string;
  taxId: string;
  timezone: string;
  currency: string;
}

function fromCompany(company: Company): FormState {
  return {
    name: company.name,
    taxId: company.taxId ?? "",
    timezone: company.settings.timezone,
    currency: company.settings.currency,
  };
}

export function EmpresaPanel() {
  const { accessToken, user } = useAuth();
  const canUpdate = (user?.role.permissions ?? []).includes(PERMISSIONS.COMPANY_UPDATE);

  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const res = await getCompany(accessToken);
    setCompany(res);
    setForm(fromCompany(res));
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !company || !form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateCompany(accessToken, {
        version: company.version,
        name: form.name.trim(),
        taxId: form.taxId.trim() || null,
        settings: { timezone: form.timezone.trim(), currency: form.currency.trim().toUpperCase() },
      });
      setCompany(updated);
      setForm(fromCompany(updated));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setError("Los datos cambiaron desde que cargaste la página. Recargá y volvé a intentar.");
      } else {
        setError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <FormField label="Nombre" htmlFor="e-name">
        <Input
          id="e-name"
          disabled={!canUpdate}
          value={form.name}
          onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
        />
      </FormField>
      <FormField label="CUIT" htmlFor="e-taxid">
        <Input
          id="e-taxid"
          disabled={!canUpdate}
          value={form.taxId}
          onChange={(e) => setForm((f) => f && { ...f, taxId: e.target.value })}
        />
      </FormField>
      <FormField label="Zona horaria" htmlFor="e-tz">
        <Input
          id="e-tz"
          disabled={!canUpdate}
          value={form.timezone}
          onChange={(e) => setForm((f) => f && { ...f, timezone: e.target.value })}
        />
      </FormField>
      <FormField label="Moneda" htmlFor="e-currency" helper="Código ISO de 3 letras, ej. ARS">
        <Input
          id="e-currency"
          disabled={!canUpdate}
          value={form.currency}
          maxLength={3}
          onChange={(e) => setForm((f) => f && { ...f, currency: e.target.value })}
        />
      </FormField>

      {canUpdate && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
          {saved && <span className="text-xs text-success">Guardado.</span>}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
