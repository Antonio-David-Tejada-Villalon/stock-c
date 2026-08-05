import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Switch } from "@stock-c/ui";
import type { Unit } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createUnit, updateUnit } from "./api";

interface FormState {
  name: string;
  abbreviation: string;
  active: boolean;
}

const emptyState: FormState = { name: "", abbreviation: "", active: true };

function fromUnit(unit: Unit): FormState {
  return { name: unit.name, abbreviation: unit.abbreviation ?? "", active: unit.active };
}

export interface UnitFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Unit;
  onSaved: (unit: Unit) => void;
}

export function UnitFormDrawer({ open, onOpenChange, unit, onSaved }: UnitFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(unit ? fromUnit(unit) : emptyState);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(unit ? fromUnit(unit) : emptyState);
      setNameError(null);
      setSubmitError(null);
    }
  }, [open, unit]);

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
      const payload = { name: form.name.trim(), abbreviation: form.abbreviation.trim() || undefined };
      const saved = unit
        ? await updateUnit(accessToken, unit.id, { ...payload, active: form.active, version: unit.version })
        : await createUnit(accessToken, payload);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "duplicate_name") {
        setNameError("Ya existe una unidad con ese nombre");
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Esta unidad cambió desde que la abriste. Cerrá y volvé a intentar.");
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
      title={unit ? "Editar unidad" : "Nueva unidad"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="unit-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar unidad"}
          </Button>
        </div>
      }
    >
      <form id="unit-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="u-name" error={nameError ?? undefined}>
          <Input
            id="u-name"
            invalid={!!nameError}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>

        <FormField label="Abreviatura" htmlFor="u-abbr" helper="Ej. kg, un, mt">
          <Input
            id="u-abbr"
            value={form.abbreviation}
            onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))}
          />
        </FormField>

        {unit && (
          <div className="flex items-center gap-2">
            <Switch
              id="u-active"
              checked={form.active}
              onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
            />
            <label htmlFor="u-active" className="text-[13px] text-text-secondary">
              Unidad activa
            </label>
          </div>
        )}

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
