import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Avatar } from "./Avatar";

export interface UserMenuProps {
  name: string;
  roleName: string;
  onLogout: () => void;
}

export function UserMenu({ name, roleName, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-[120ms] hover:bg-bg-sunken"
        >
          <Avatar name={name} />
          <span className="hidden text-xs sm:block">
            <span className="block font-semibold text-text">{name}</span>
            <span className="block text-text-tertiary">{roleName}</span>
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="min-w-[180px] rounded-md border border-border bg-bg-raised p-1 shadow-lg"
        >
          <DropdownMenu.Item
            onSelect={onLogout}
            className="cursor-pointer rounded-sm px-2 py-1.5 text-[13px] text-text outline-none data-[highlighted]:bg-accent-wash data-[highlighted]:text-accent"
          >
            Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
