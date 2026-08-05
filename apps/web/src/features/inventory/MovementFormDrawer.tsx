import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, FormField, Input, Select, Textarea } from "@stock-c/ui";
import type { Product, StockMovementType } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { createMovement } from "./api";

const DECIMAL_PATTERN = /^\d+(\.\d{1,4})?$/;

interface FormState {
  productId: string;
  type: StockMovementType;
  quantity: string;
  direction: "sum" | "subtract";
  reason: string;
  reference: string;
}

function emptyState(defaultProductId?: string): FormState {
  return {
    productId: defaultProductId ?? "",
    type: "entrada",
    quantity: "",
    direction: "sum",
    reason: "",
    reference: "",
  };
}

export interface MovementFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  defaultProductId?: string;
  onSaved: () => void;
}

export function MovementFormDrawer({
  open,
  onOpenChange,
  products,
  defaultProductId,
  onSaved,
}: MovementFormDrawerProps) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(emptyState(defaultProductId));
  const [errors, setErrors] = useState<Partial<Record<"productId" | "quantity" | "reason", string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyState(defaultProductId));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, defaultProductId]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.productId) next.productId = "Elegí un producto";
    if (!DECIMAL_PATTERN.test(form.quantity)) next.quantity = "Cantidad inválida (ej. 10 o 10.5)";
    if (form.type === "ajuste" && !form.reason.trim()) next.reason = "Un ajuste necesita un motivo";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const signedQuantity =
        form.type === "ajuste" && form.direction === "subtract" ? `-${form.quantity}` : form.quantity;
      await createMovement(accessToken, {
        productId: form.productId,
        type: form.type,
        quantity: signedQuantity,
        reason: form.reason.trim() || undefined,
        reference: form.reference.trim() || undefined,
        clientMutationId: crypto.randomUUID(),
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "insufficient_stock") {
        setSubmitError("No hay stock suficiente para esta operación.");
      } else if (err instanceof ApiAuthError && err.code === "invalid_quantity") {
        setErrors((prev) => ({ ...prev, quantity: "Cantidad inválida para este tipo de movimiento" }));
      } else if (err instanceof ApiAuthError && err.code === "reason_required") {
        setErrors((prev) => ({ ...prev, reason: "Un ajuste necesita un motivo" }));
      } else {
        setSubmitError("No se pudo registrar el movimiento. Intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo movimiento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="movement-form" disabled={submitting}>
            {submitting ? "Guardando…" : "Registrar movimiento"}
          </Button>
        </div>
      }
    >
      <form id="movement-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Producto" htmlFor="m-product" error={errors.productId}>
          <Select
            id="m-product"
            invalid={!!errors.productId}
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            disabled={!!defaultProductId}
          >
            <option value="">Elegí un producto…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Tipo de movimiento" htmlFor="m-type">
          <Select
            id="m-type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as StockMovementType }))}
          >
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </Select>
        </FormField>

        {form.type === "ajuste" && (
          <FormField label="Dirección del ajuste" htmlFor="m-direction">
            <Select
              id="m-direction"
              value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as "sum" | "subtract" }))}
            >
              <option value="sum">Sumar stock</option>
              <option value="subtract">Restar stock</option>
            </Select>
          </FormField>
        )}

        <FormField label="Cantidad" htmlFor="m-quantity" error={errors.quantity}>
          <Input
            id="m-quantity"
            inputMode="decimal"
            invalid={!!errors.quantity}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
        </FormField>

        <FormField
          label={form.type === "ajuste" ? "Motivo" : "Motivo (opcional)"}
          htmlFor="m-reason"
          error={errors.reason}
        >
          <Textarea
            id="m-reason"
            rows={2}
            invalid={!!errors.reason}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </FormField>

        <FormField label="Referencia (opcional)" htmlFor="m-reference" helper="Ej. nº de remito u orden">
          <Input
            id="m-reference"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          />
        </FormField>

        {submitError && <p className="text-xs text-danger">{submitError}</p>}
      </form>
    </Drawer>
  );
}
