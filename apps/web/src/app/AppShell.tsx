import { Link, Outlet } from "react-router-dom";
import {
  Avatar,
  Logo,
  NotificationBell,
  Sidebar,
  SidebarBrand,
  SidebarFooter,
  SidebarNavItem,
  SidebarSection,
  TenantSwitch,
  ThemeToggle,
  Topbar,
  UserMenu,
} from "@stock-c/ui";
import { useAuth } from "../features/auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useCompanyBranding } from "../theme/useCompanyBranding";
import { SyncStatusBadge } from "../offline/SyncStatusBadge";
import { useNotifications } from "../features/notifications/useNotifications";

export function AppShell() {
  const { user, accessToken, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { logoUrl, companyName } = useCompanyBranding();
  const notifications = useNotifications(accessToken);

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarBrand>
          <Logo size={22} imageUrl={logoUrl} />
        </SidebarBrand>

        <TenantSwitch
          companyName={companyName ?? `Empresa ${user.companyId.slice(-4)}`}
          avatar={<Avatar name="EM" size="sm" />}
        />

        <SidebarSection>
          <SidebarNavItem to="/" end icon="▤">
            Panel
          </SidebarNavItem>
          <SidebarNavItem to="/productos" icon="▦">
            Productos
          </SidebarNavItem>
          <SidebarNavItem to="/categorias" icon="▧">
            Categorías
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
          <Link to="/productos" className="text-xs text-text-tertiary hover:text-text-secondary hover:underline">
            Buscar producto…
          </Link>
          <div className="flex items-center gap-3">
            <SyncStatusBadge accessToken={accessToken} />
            <NotificationBell
              unreadCount={notifications.unreadCount}
              items={notifications.items}
              loading={notifications.loadingItems}
              onOpen={() => void notifications.loadItems()}
              onMarkRead={(id) => void notifications.markRead(id)}
            />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <UserMenu name={user.name} roleName={user.role.name} onLogout={() => void logout()} />
          </div>
        </Topbar>
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
