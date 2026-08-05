import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Brand } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { deactivateBrand, listBrands } from "./api";
import { BrandFormDrawer } from "./BrandFormDrawer";

export function BrandsPanel() {
  const { accessToken, user } = useAuth();
  const permissions = user?.role.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.BRAND_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.BRAND_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.BRAND_DELETE);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | undefined>(undefined);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listBrands(accessToken);
      setBrands(res.items);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setDrawerOpen(true);
  }

  async function handleDeactivate(brand: Brand) {
    if (!accessToken) return;
    if (!confirm(`¿Desactivar "${brand.name}"? Podés reactivarla después editándola.`)) return;
    await deactivateBrand(accessToken, brand.id);
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {canCreate && <Button onClick={openCreate}>Nueva marca</Button>}
      </div>

      {!loading && brands.length === 0 ? (
        <EmptyState title="Todavía no hay marcas" description="Creá la primera con el botón de arriba." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Marca</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id} className="hover:bg-bg-sunken">
                <Td className="font-medium">{brand.name}</Td>
                <Td>
                  <Badge variant={brand.active ? "success" : "neutral"}>
                    {brand.active ? "Activa" : "Inactiva"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 text-xs">
                    {canUpdate && (
                      <button type="button" className="text-accent hover:underline" onClick={() => openEdit(brand)}>
                        Editar
                      </button>
                    )}
                    {canDelete && brand.active && (
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => void handleDeactivate(brand)}
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <BrandFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} brand={editing} onSaved={() => void load()} />
    </div>
  );
}
