import { cn } from "./cn";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-accent-wash font-bold text-accent",
        size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[11px]",
        className,
      )}
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
