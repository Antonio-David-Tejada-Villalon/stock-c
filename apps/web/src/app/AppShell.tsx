import { Outlet } from "react-router-dom";
import {
  Avatar,
  Sidebar,
  SidebarBrand,
  SidebarFooter,
  SidebarNavItem,
  SidebarSection,
  TenantSwitch,
  Topbar,
  UserMenu,
} from "@stock-c/ui";
import { useAuth } from "../features/auth/AuthContext";

export function AppShell() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarBrand>
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-accent text-[11px] font-bold text-accent-contrast">
            S
          </span>
          STOCK-C
        </SidebarBrand>

        <TenantSwitch
          companyName={`Empresa ${user.companyId.slice(-4)}`}
          avatar={<Avatar name="EM" size="sm" />}
        />

        <SidebarSection>
          <SidebarNavItem to="/" end icon="▤">
            Panel
          </SidebarNavItem>
          <SidebarNavItem to="/productos" icon="▦">
            Productos
          </SidebarNavItem>
          <SidebarNavItem to="/movimientos" icon="↕">
            Movimientos
          </SidebarNavItem>
          <SidebarNavItem to="/reportes" icon="▥">
            Reportes
          </SidebarNavItem>
        </SidebarSection>

        <SidebarSection>
          <SidebarNavItem to="/configuracion" icon="⚙">
            Configuración
          </SidebarNavItem>
        </SidebarSection>

        <SidebarFooter>
          <Avatar name={user.name} size="sm" />
          <span className="text-text-secondary">{user.name}</span>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar>
          <span className="text-xs text-text-tertiary">Buscar producto… (Fase 7)</span>
          <UserMenu name={user.name} roleName={user.role.name} onLogout={() => void logout()} />
        </Topbar>
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
