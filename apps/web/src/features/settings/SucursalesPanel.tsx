import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Branch } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { ApiAuthError } from "../auth/api";
import { activateBranch, deleteBranch, listBranches } from "./api";
import { BranchFormDrawer } from "./BranchFormDrawer";

export function SucursalesPanel() {
  const { accessToken, user } = useAuth();
  const canManage = (user?.role.permissions ?? []).includes(PERMISSIONS.BRANCH_MANAGE);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | undefined>(undefined);
  const [activating, setActivating] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listBranches(accessToken);
      setBranches(res.items);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleActivate(branch: Branch) {
    if (!accessToken) return;
    const current = branches.find((b) => b.active);
    const warning =
      current && current.id !== branch.id
        ? `Esto desactivará "${current.name}", que es la sucursal activa hoy. ¿Activar "${branch.name}" en su lugar?`
        : `¿Activar "${branch.name}"?`;
    if (!confirm(warning)) return;
    setActivating(branch.id);
    try {
      await activateBranch(accessToken, branch.id);
      await load();
    } finally {
      setActivating(null);
    }
  }

  async function handleDelete(branch: Branch) {
    if (!accessToken) return;
    if (!confirm(`¿Eliminar definitivamente la sucursal "${branch.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(branch.id);
    setError(null);
    try {
      await deleteBranch(accessToken, branch.id);
      await load();
    } catch (err) {
      if (err instanceof ApiAuthError && err.code === "cannot_delete_active") {
        setError("No podés eliminar la sucursal activa — activá otra primero.");
      } else {
        setError("No se pudo eliminar. Intentá de nuevo.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-secondary">
          El sistema opera con exactamente una sucursal activa a la vez.
        </p>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setDrawerOpen(true);
            }}
          >
            Nueva sucursal
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {!loading && branches.length === 0 ? (
        <EmptyState title="Todavía no hay sucursales" description="Creá la primera con el botón de arriba." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Sucursal</Th>
              <Th>Código</Th>
              <Th>Dirección</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="hover:bg-bg-sunken">
                <Td className="font-medium">{branch.name}</Td>
                <Td className="font-mono text-[12px] text-text-tertiary">{branch.code}</Td>
                <Td>{branch.address ?? "—"}</Td>
                <Td>
                  <Badge variant={branch.active ? "success" : "neutral"}>
                    {branch.active ? "Activa" : "Inactiva"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 text-xs">
                    {canManage && !branch.active && (
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        disabled={activating === branch.id}
                        onClick={() => void handleActivate(branch)}
                      >
                        Activar
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => {
                          setEditing(branch);
                          setDrawerOpen(true);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {canManage && !branch.active && (
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        disabled={deletingId === branch.id}
                        onClick={() => void handleDelete(branch)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <BranchFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} branch={editing} onSaved={() => void load()} />
    </div>
  );
}
