import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Unit } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { deactivateUnit, listUnits } from "./api";
import { UnitFormDrawer } from "./UnitFormDrawer";

export function UnitsPanel() {
  const { accessToken, user } = useAuth();
  const permissions = user?.role.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.UNIT_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.UNIT_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.UNIT_DELETE);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | undefined>(undefined);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listUnits(accessToken);
      setUnits(res.items);
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

  function openEdit(unit: Unit) {
    setEditing(unit);
    setDrawerOpen(true);
  }

  async function handleDeactivate(unit: Unit) {
    if (!accessToken) return;
    if (!confirm(`¿Desactivar "${unit.name}"? Podés reactivarla después editándola.`)) return;
    await deactivateUnit(accessToken, unit.id);
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {canCreate && <Button onClick={openCreate}>Nueva unidad</Button>}
      </div>

      {!loading && units.length === 0 ? (
        <EmptyState title="Todavía no hay unidades" description="Creá la primera con el botón de arriba." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Unidad</Th>
              <Th>Abreviatura</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="hover:bg-bg-sunken">
                <Td className="font-medium">{unit.name}</Td>
                <Td className="font-mono text-text-tertiary">{unit.abbreviation ?? "—"}</Td>
                <Td>
                  <Badge variant={unit.active ? "success" : "neutral"}>
                    {unit.active ? "Activa" : "Inactiva"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 text-xs">
                    {canUpdate && (
                      <button type="button" className="text-accent hover:underline" onClick={() => openEdit(unit)}>
                        Editar
                      </button>
                    )}
                    {canDelete && unit.active && (
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => void handleDeactivate(unit)}
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

      <UnitFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} unit={editing} onSaved={() => void load()} />
    </div>
  );
}
