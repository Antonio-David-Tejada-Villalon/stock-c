import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type TeamUser } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { listTeamUsers } from "./api";
import { TeamUserFormDrawer } from "./TeamUserFormDrawer";
import { MiPerfilForm } from "./MiPerfilForm";

export function UsuariosPanel() {
  const { accessToken, user } = useAuth();
  const canManage = (user?.role.permissions ?? []).includes(PERMISSIONS.USER_MANAGE);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TeamUser | undefined>(undefined);

  const load = useCallback(async () => {
    if (!accessToken || !canManage) return;
    setLoading(true);
    try {
      const res = await listTeamUsers(accessToken);
      setTeamUsers(res.items);
    } finally {
      setLoading(false);
    }
  }, [accessToken, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <MiPerfilForm />

      {canManage && (
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Equipo</h3>
            <Button
              onClick={() => {
                setEditing(undefined);
                setDrawerOpen(true);
              }}
            >
              Nuevo usuario
            </Button>
          </div>

          {!loading && teamUsers.length === 0 ? (
            <EmptyState title="Todavía no hay otros usuarios" description="Invitá al primero con el botón de arriba." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Email</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {teamUsers.map((teamUser) => (
                  <tr key={teamUser.id} className="hover:bg-bg-sunken">
                    <Td className="font-medium">{teamUser.name}</Td>
                    <Td>{teamUser.email}</Td>
                    <Td>{teamUser.roleName}</Td>
                    <Td>
                      <Badge variant={teamUser.active ? "success" : "neutral"}>
                        {teamUser.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end text-xs">
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() => {
                            setEditing(teamUser);
                            setDrawerOpen(true);
                          }}
                        >
                          Editar
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <TeamUserFormDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            teamUser={editing}
            onSaved={() => void load()}
          />
        </div>
      )}
    </div>
  );
}
