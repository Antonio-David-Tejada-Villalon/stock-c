import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Select, Switch } from "@stock-c/ui";
import type { Category } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createCategory, updateCategory } from "./api";
import { descendantIds, flattenTree } from "./categoryTree";
import { CATEGORY_ICONS } from "./categoryIcons";
import { IconPicker } from "./IconPicker";

const COLOR_PRESETS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#84CC16",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#6B7280",
];
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface FormState {
  name: string;
  parentId: string;
  code: string;
  icon: string;
  color: string;
  imageUrl: string;
  active: boolean;
}

function emptyState(defaultParentId?: string): FormState {
  return { name: "", parentId: defaultParentId ?? "", code: "", icon: "", color: "", imageUrl: "", active: true };
}

function fromCategory(category: Category): FormState {
  return {
    name: category.name,
    parentId: category.parentId ?? "",
    code: category.code ?? "",
    icon: category.icon ?? "",
    color: category.color ?? "",
    imageUrl: category.imageUrl ?? "",
    active: category.active,
  };
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
  const [colorError, setColorError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(category ? fromCategory(category) : emptyState(defaultParentId));
      setNameError(null);
      setColorError(null);
      setSubmitError(null);
    }
  }, [open, category, defaultParentId]);

  const parentOptions = useMemo(() => {
    const excluded = category ? descendantIds(categories, category.id) : new Set<string>();
    return flattenTree(categories).filter((c) => !excluded.has(c.id));
  }, [categories, category]);

  function validate(): boolean {
    let ok = true;
    if (!form.name.trim()) {
      setNameError("El nombre es obligatorio");
      ok = false;
    } else {
      setNameError(null);
    }
    if (form.color && !HEX_PATTERN.test(form.color)) {
      setColorError("Color inválido (formato #RRGGBB)");
      ok = false;
    } else {
      setColorError(null);
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = category
        ? await updateCategory(accessToken, category.id, {
            name: form.name.trim(),
            parentId: form.parentId || null,
            code: form.code.trim() || null,
            icon: form.icon || null,
            color: form.color || null,
            imageUrl: form.imageUrl.trim() || null,
            active: form.active,
            version: category.version,
          })
        : await createCategory(accessToken, {
            name: form.name.trim(),
            parentId: form.parentId || undefined,
            code: form.code.trim() || undefined,
            icon: form.icon || undefined,
            color: form.color || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
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
      } else if (err instanceof ApiAuthError && err.code === "duplicate_code") {
        setSubmitError("Ya existe una categoría con ese código.");
      } else {
        setSubmitError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const SelectedIcon = form.icon ? CATEGORY_ICONS[form.icon] : undefined;

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

        <FormField label="Código" htmlFor="c-code" helper="Opcional, único (ej. BEB-001)">
          <Input
            id="c-code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
        </FormField>

        <FormField label="Ícono" htmlFor="c-icon">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-border-strong text-text-secondary">
              {SelectedIcon ? <SelectedIcon size={18} aria-hidden="true" /> : <span className="text-xs">—</span>}
            </div>
            <div className="flex-1">
              <IconPicker value={form.icon} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
            </div>
          </div>
        </FormField>

        <FormField label="Color" htmlFor="c-color" error={colorError ?? undefined}>
          <div className="flex items-center gap-3">
            <input
              id="c-color"
              type="color"
              value={form.color || "#94a3b8"}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="h-9 w-9 flex-none cursor-pointer rounded-md border border-border-strong bg-bg-raised p-0.5"
              aria-label="Elegir color"
            />
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  onClick={() => setForm((f) => ({ ...f, color: preset }))}
                  className="h-6 w-6 rounded-full border border-border-strong"
                  style={{ backgroundColor: preset }}
                  aria-label={`Color ${preset}`}
                />
              ))}
              {form.color && (
                <button
                  type="button"
                  title="Quitar color"
                  onClick={() => setForm((f) => ({ ...f, color: "" }))}
                  className="text-xs text-text-tertiary hover:text-danger"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </FormField>

        <FormField label="Imagen (URL)" htmlFor="c-image" helper="Sin subida de archivos todavía — pegá una URL">
          <Input
            id="c-image"
            type="url"
            placeholder="https://…"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          {form.imageUrl && (
            <img
              src={form.imageUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded-md border border-border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
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
