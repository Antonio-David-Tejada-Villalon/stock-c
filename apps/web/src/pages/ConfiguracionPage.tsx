import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stock-c/ui";
import { EmpresaPanel } from "../features/settings/EmpresaPanel";
import { SucursalesPanel } from "../features/settings/SucursalesPanel";
import { UsuariosPanel } from "../features/settings/UsuariosPanel";
import { AparienciaPanel } from "../features/settings/AparienciaPanel";
import { DatosPanel } from "../features/settings/DatosPanel";

export function ConfiguracionPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="sucursales">Sucursales</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="pt-4">
          <EmpresaPanel />
        </TabsContent>
        <TabsContent value="sucursales" className="pt-4">
          <SucursalesPanel />
        </TabsContent>
        <TabsContent value="usuarios" className="pt-4">
          <UsuariosPanel />
        </TabsContent>
        <TabsContent value="apariencia" className="pt-4">
          <AparienciaPanel />
        </TabsContent>
        <TabsContent value="datos" className="pt-4">
          <DatosPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
