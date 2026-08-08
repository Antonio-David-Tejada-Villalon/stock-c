import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "react-router-dom";

export interface NotificationItem {
  id: string;
  type: "low_stock" | "movement_rejected";
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationBellProps {
  unreadCount: number;
  items: NotificationItem[];
  loading: boolean;
  onOpen: () => void;
  onMarkRead: (id: string) => void;
}

function linkFor(type: NotificationItem["type"]): string {
  return type === "low_stock" ? "/productos" : "/movimientos";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NotificationBell({ unreadCount, items, loading, onOpen, onMarkRead }: NotificationBellProps) {
  return (
    <DropdownMenu.Root onOpenChange={(open) => open && onOpen()}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : "Notificaciones"}
          title="Notificaciones"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-[120ms] hover:bg-bg-sunken hover:text-text"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-80 rounded-md border border-border bg-bg-raised p-1 shadow-lg"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Notificaciones
          </div>
          {loading && <div className="px-2 py-3 text-[13px] text-text-tertiary">Cargando…</div>}
          {!loading && items.length === 0 && (
            <div className="px-2 py-3 text-[13px] text-text-tertiary">No hay notificaciones.</div>
          )}
          {!loading &&
            items.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col gap-1 rounded-sm px-2 py-2 text-[13px] ${item.read ? "opacity-60" : ""}`}
              >
                <Link to={linkFor(item.type)} className="text-text hover:underline">
                  {item.message}
                </Link>
                <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                  <span>{relativeTime(item.createdAt)}</span>
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                      className="text-accent hover:underline"
                    >
                      Marcar como leída
                    </button>
                  )}
                </div>
              </div>
            ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
