import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Category } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { deactivateCategory, listCategories } from "./api";
import { CategoryFormDrawer } from "./CategoryFormDrawer";
import { flattenTree } from "./categoryTree";

export function CategoriesPanel() {
  const { accessToken, user } = useAuth();
  const permissions = user?.role.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.CATEGORY_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.CATEGORY_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.CATEGORY_DELETE);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listCategories(accessToken);
      setCategories(res.items);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(parentId?: string) {
    setEditing(undefined);
    setDefaultParentId(parentId);
    setDrawerOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDefaultParentId(undefined);
    setDrawerOpen(true);
  }

  async function handleDeactivate(category: Category) {
    if (!accessToken) return;
    if (!confirm(`¿Desactivar "${category.name}"? Podés reactivarla después editándola.`)) return;
    await deactivateCategory(accessToken, category.id);
    void load();
  }

  const nodes = flattenTree(categories);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-secondary">
          Categorías con subcategorías anidadas sin límite de profundidad.
        </p>
        {canCreate && <Button onClick={() => openCreate()}>Nueva categoría</Button>}
      </div>

      {!loading && nodes.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          description="Creá la primera con el botón de arriba."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Categoría</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-bg-sunken">
                <Td className="font-medium">
                  <span style={{ paddingLeft: `${node.depth * 20}px` }}>
                    {node.depth > 0 && <span className="text-text-tertiary">└ </span>}
                    {node.name}
                  </span>
                </Td>
                <Td>
                  <Badge variant={node.active ? "success" : "neutral"}>
                    {node.active ? "Activa" : "Inactiva"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 text-xs">
                    {canCreate && (
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => openCreate(node.id)}
                      >
                        + Subcategoría
                      </button>
                    )}
                    {canUpdate && (
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => openEdit(node)}
                      >
                        Editar
                      </button>
                    )}
                    {canDelete && node.active && (
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => void handleDeactivate(node)}
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <CategoryFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        category={editing}
        defaultParentId={defaultParentId}
        categories={categories}
        onSaved={() => void load()}
      />
    </div>
  );
}
