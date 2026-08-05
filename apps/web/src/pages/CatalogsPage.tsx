import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stock-c/ui";
import { BrandsPanel } from "../features/catalogs/BrandsPanel";
import { CategoriesPanel } from "../features/catalogs/CategoriesPanel";
import { UnitsPanel } from "../features/catalogs/UnitsPanel";

export function CatalogsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Categorías, marcas y unidades</h1>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="pt-4">
          <CategoriesPanel />
        </TabsContent>
        <TabsContent value="brands" className="pt-4">
          <BrandsPanel />
        </TabsContent>
        <TabsContent value="units" className="pt-4">
          <UnitsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
