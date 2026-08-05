import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "./cn";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn("flex items-center gap-1 border-b border-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-[120ms]",
        "hover:text-text",
        "data-[state=active]:border-accent data-[state=active]:text-accent",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RadixTabs.Content;
