import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "./cn";

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-[220px] flex-none flex-col gap-4 border-r border-border bg-bg-sunken p-4">
      {children}
    </aside>
  );
}

export function SidebarBrand({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-2 text-[15px] font-bold">{children}</div>;
}

export function SidebarSection({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

export interface SidebarNavItemProps {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
  end?: boolean;
}

export function SidebarNavItem({ to, icon, children, end }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text-secondary transition-colors duration-[120ms]",
          isActive
            ? "bg-accent-wash font-semibold text-accent"
            : "hover:bg-bg-raised hover:text-text",
        )
      }
    >
      {icon && (
        <span className="w-3.5 text-center text-xs" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </NavLink>
  );
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex items-center gap-2 px-2 py-2 text-xs">{children}</div>;
}
