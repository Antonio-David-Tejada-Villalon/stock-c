import * as RadixSwitch from "@radix-ui/react-switch";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  "aria-label"?: string;
}

export function Switch({ checked, onCheckedChange, id, ...rest }: SwitchProps) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-5 w-9 flex-none rounded-full bg-border-strong outline-none transition-colors duration-[120ms] data-[state=checked]:bg-accent"
      {...rest}
    >
      <RadixSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-bg-raised shadow transition-transform duration-[190ms] will-change-transform data-[state=checked]:translate-x-[18px]" />
    </RadixSwitch.Root>
  );
}
