import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Switch } from "@stock-c/ui";
import type { Brand } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createBrand, updateBrand } from "./api";

interface FormState {
  name: string;
  active: boolean;
}

const emptyState: FormState = { name: "", active: true };

function fromBrand(brand: Brand): FormState {
  return { name: brand.name, active: brand.active };
}

export interface BrandFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: Brand;
  onSaved: (brand: Brand) => void;
}

export function BrandFormDrawer({ open, onOpenChange, brand, onSaved }: BrandFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(brand ? fromBrand(brand) : emptyState);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(brand ? fromBrand(brand) : emptyState);
      setNameError(null);
      setSubmitError(null);
    }
  }, [open, brand]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.name.trim()) {
      setNameError("El nombre es obligatorio");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = brand
        ? await updateBrand(accessToken, brand.id, {
            name: form.name.trim(),
            active: form.active,
            version: brand.version,
          })
        : await createBrand(accessToken, { name: form.name.trim() });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "duplicate_name") {
        setNameError("Ya existe una marca con ese nombre");
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Esta marca cambió desde que la abriste. Cerrá y volvé a intentar.");
      } else {
        setSubmitError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={brand ? "Editar marca" : "Nueva marca"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar marca"}
          </Button>
        </div>
      }
    >
      <form id="brand-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="b-name" error={nameError ?? undefined}>
          <Input
            id="b-name"
            invalid={!!nameError}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>

        {brand && (
          <div className="flex items-center gap-2">
            <Switch
              id="b-active"
              checked={form.active}
              onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
            />
            <label htmlFor="b-active" className="text-[13px] text-text-secondary">
              Marca activa
            </label>
          </div>
        )}

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
