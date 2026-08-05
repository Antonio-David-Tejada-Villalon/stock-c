import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Select, Switch } from "@stock-c/ui";
import type { Category } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createCategory, updateCategory } from "./api";
import { descendantIds, flattenTree } from "./categoryTree";

interface FormState {
  name: string;
  parentId: string;
  active: boolean;
}

function emptyState(defaultParentId?: string): FormState {
  return { name: "", parentId: defaultParentId ?? "", active: true };
}

function fromCategory(category: Category): FormState {
  return { name: category.name, parentId: category.parentId ?? "", active: category.active };
}

export interface CategoryFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  /** Preselecciona el padre al crear una subcategoría desde la fila del árbol. */
  defaultParentId?: string;
  categories: Category[];
  onSaved: (category: Category) => void;
}

export function CategoryFormDrawer({
  open,
  onOpenChange,
  category,
  defaultParentId,
  categories,
  onSaved,
}: CategoryFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(category ? fromCategory(category) : emptyState(defaultParentId));
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(category ? fromCategory(category) : emptyState(defaultParentId));
      setNameError(null);
      setSubmitError(null);
    }
  }, [open, category, defaultParentId]);

  const parentOptions = useMemo(() => {
    const excluded = category ? descendantIds(categories, category.id) : new Set<string>();
    return flattenTree(categories).filter((c) => !excluded.has(c.id));
  }, [categories, category]);

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
      const saved = category
        ? await updateCategory(accessToken, category.id, {
            name: form.name.trim(),
            parentId: form.parentId || null,
            active: form.active,
            version: category.version,
          })
        : await createCategory(accessToken, {
            name: form.name.trim(),
            parentId: form.parentId || undefined,
          });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "cycle") {
        setSubmitError("Esa categoría padre generaría un ciclo (es una subcategoría de esta misma).");
      } else if (err instanceof ApiAuthError && err.code === "invalid_parent") {
        setSubmitError("La categoría padre elegida ya no existe. Recargá e intentá de nuevo.");
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Esta categoría cambió desde que la abriste. Cerrá y volvé a intentar.");
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
      title={category ? "Editar categoría" : "Nueva categoría"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar categoría"}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="c-name" error={nameError ?? undefined}>
          <Input
            id="c-name"
            invalid={!!nameError}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>

        <FormField label="Categoría padre" htmlFor="c-parent" helper="Vacío = categoría raíz">
          <Select
            id="c-parent"
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
          >
            <option value="">— Sin padre —</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {"—".repeat(opt.depth)} {opt.name}
              </option>
            ))}
          </Select>
        </FormField>

        {category && (
          <div className="flex items-center gap-2">
            <Switch
              id="c-active"
              checked={form.active}
              onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
            />
            <label htmlFor="c-active" className="text-[13px] text-text-secondary">
              Categoría activa
            </label>
          </div>
        )}

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
