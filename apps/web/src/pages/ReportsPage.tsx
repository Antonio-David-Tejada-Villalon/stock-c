import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stock-c/ui";
import { CatalogSummaryPanel } from "../features/reports/CatalogSummaryPanel";
import { InventoryValuationPanel } from "../features/reports/InventoryValuationPanel";
import { LowStockPanel } from "../features/reports/LowStockPanel";
import { MovementsReportPanel } from "../features/reports/MovementsReportPanel";

export function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>

      <Tabs defaultValue="valuation">
        <TabsList>
          <TabsTrigger value="valuation">Valorización</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="low-stock">Stock bajo</TabsTrigger>
        </TabsList>

        <TabsContent value="valuation" className="pt-4">
          <InventoryValuationPanel />
        </TabsContent>
        <TabsContent value="movements" className="pt-4">
          <MovementsReportPanel />
        </TabsContent>
        <TabsContent value="summary" className="pt-4">
          <CatalogSummaryPanel />
        </TabsContent>
        <TabsContent value="low-stock" className="pt-4">
          <LowStockPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
