import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input } from "@stock-c/ui";
import type { Branch } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createBranch, updateBranch } from "./api";

interface FormState {
  name: string;
  code: string;
  address: string;
}

function emptyState(): FormState {
  return { name: "", code: "", address: "" };
}

function fromBranch(branch: Branch): FormState {
  return { name: branch.name, code: branch.code, address: branch.address ?? "" };
}

export interface BranchFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch;
  onSaved: () => void;
}

export function BranchFormDrawer({ open, onOpenChange, branch, onSaved }: BranchFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(branch ? fromBranch(branch) : emptyState());
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(branch ? fromBranch(branch) : emptyState());
      setNameError(null);
      setCodeError(null);
      setSubmitError(null);
    }
  }, [open, branch]);

  function validate(): boolean {
    let ok = true;
    if (!form.name.trim()) {
      setNameError("El nombre es obligatorio");
      ok = false;
    } else setNameError(null);
    if (!form.code.trim()) {
      setCodeError("El código es obligatorio");
      ok = false;
    } else setCodeError(null);
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (branch) {
        await updateBranch(accessToken, branch.id, {
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim() || null,
          version: branch.version,
        });
      } else {
        await createBranch(accessToken, {
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim() || undefined,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "duplicate_code") {
        setSubmitError("Ya existe una sucursal con ese código.");
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Esta sucursal cambió desde que la abriste. Cerrá y volvé a intentar.");
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
      title={branch ? "Editar sucursal" : "Nueva sucursal"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="branch-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar sucursal"}
          </Button>
        </div>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="b-name" error={nameError ?? undefined}>
          <Input id="b-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Código" htmlFor="b-code" error={codeError ?? undefined} helper="Ej. NORTE, CENTRAL">
          <Input id="b-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        </FormField>
        <FormField label="Dirección" htmlFor="b-address">
          <Input
            id="b-address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </FormField>
        {!branch && (
          <p className="text-xs text-text-tertiary">
            La sucursal se crea inactiva. Activala desde la tabla cuando quieras que sea la operativa.
          </p>
        )}
        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
