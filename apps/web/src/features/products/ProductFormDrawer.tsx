import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Select, Switch, Textarea } from "@stock-c/ui";
import type { Brand, Category, Product, Unit } from "@stock-c/shared-types";
import { flattenTree } from "../catalogs/categoryTree";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createProduct, updateProduct } from "./api";

const DECIMAL_PATTERN = /^\d+(\.\d{1,4})?$/;

interface FormState {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  barcode: string;
  price: string;
  cost: string;
  active: boolean;
}

const emptyState: FormState = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  brandId: "",
  unitId: "",
  barcode: "",
  price: "",
  cost: "",
  active: true,
};

function fromProduct(product: Product): FormState {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    unitId: product.unitId ?? "",
    barcode: product.barcode ?? "",
    price: product.price,
    cost: product.cost ?? "",
    active: product.active,
  };
}

export interface ProductFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  onSaved: (product: Product) => void;
}

export function ProductFormDrawer({
  open,
  onOpenChange,
  product,
  categories,
  brands,
  units,
  onSaved,
}: ProductFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(product ? fromProduct(product) : emptyState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(product ? fromProduct(product) : emptyState);
      setErrors({});
      setSubmitError(null);
    }
  }, [open, product]);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.sku.trim()) next.sku = "El SKU es obligatorio";
    if (!form.name.trim()) next.name = "El nombre es obligatorio";
    if (!DECIMAL_PATTERN.test(form.price)) next.price = "Precio inválido (ej. 1250.00)";
    if (form.cost && !DECIMAL_PATTERN.test(form.cost)) next.cost = "Costo inválido (ej. 800.00)";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        price: form.price,
        cost: form.cost || undefined,
      };
      const saved = product
        ? await updateProduct(accessToken, product.id, {
            ...payload,
            categoryId: form.categoryId || null,
            brandId: form.brandId || null,
            unitId: form.unitId || null,
            active: form.active,
            version: product.version,
          })
        : await createProduct(accessToken, {
            ...payload,
            categoryId: form.categoryId || undefined,
            brandId: form.brandId || undefined,
            unitId: form.unitId || undefined,
          });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "duplicate_sku") {
        setErrors((prev) => ({ ...prev, sku: "Ya existe un producto con ese SKU" }));
      } else if (err instanceof ApiAuthError && err.code === "version_conflict") {
        setSubmitError("Este producto cambió desde que lo abriste. Cerrá y volvé a intentar.");
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
      title={product ? "Editar producto" : "Nuevo producto"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar producto"}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="p-name" error={errors.name}>
          <Input
            id="p-name"
            invalid={!!errors.name}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>

        <FormField label="SKU" htmlFor="p-sku" error={errors.sku}>
          <Input
            id="p-sku"
            invalid={!!errors.sku}
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="p-description">
          <Textarea
            id="p-description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Categoría" htmlFor="p-category">
            <Select
              id="p-category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">— Sin categoría —</option>
              {flattenTree(categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {"—".repeat(c.depth)} {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Marca" htmlFor="p-brand">
            <Select
              id="p-brand"
              value={form.brandId}
              onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
            >
              <option value="">— Sin marca —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unidad" htmlFor="p-unit">
            <Select
              id="p-unit"
              value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
            >
              <option value="">— Sin unidad —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.abbreviation ? ` (${u.abbreviation})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Código de barras" htmlFor="p-barcode">
          <Input
            id="p-barcode"
            value={form.barcode}
            onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Precio" htmlFor="p-price" error={errors.price}>
            <Input
              id="p-price"
              inputMode="decimal"
              invalid={!!errors.price}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </FormField>
          <FormField label="Costo" htmlFor="p-cost" error={errors.cost}>
            <Input
              id="p-cost"
              inputMode="decimal"
              invalid={!!errors.cost}
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            />
          </FormField>
        </div>

        {product && (
          <div className="flex items-center gap-2">
            <Switch
              id="p-active"
              checked={form.active}
              onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
            />
            <label htmlFor="p-active" className="text-[13px] text-text-secondary">
              Producto activo
            </label>
          </div>
        )}

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
