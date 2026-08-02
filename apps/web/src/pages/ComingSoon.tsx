import { EmptyState } from "@stock-c/ui";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState glyph="🚧" title="Todavía no está construido" description={`Llega en la ${phase}.`} />
    </div>
  );
}
