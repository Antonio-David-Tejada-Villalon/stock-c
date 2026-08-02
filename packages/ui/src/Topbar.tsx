import type { ReactNode } from "react";

export function Topbar({ children }: { children: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3">
      {children}
    </header>
  );
}

export function TenantSwitch({ companyName, avatar }: { companyName: string; avatar: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg-raised px-2 py-1.5 text-xs">
      {avatar}
      <span className="font-medium">{companyName}</span>
    </div>
  );
}
