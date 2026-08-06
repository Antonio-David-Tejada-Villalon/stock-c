import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, EmptyState, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Category } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { deactivateCategory, listCategories, moveCategory } from "./api";
import { CategoryFormDrawer } from "./CategoryFormDrawer";
import { flattenTree } from "./categoryTree";
import { CATEGORY_ICONS } from "./categoryIcons";

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
  const [moving, setMoving] = useState<string | null>(null);

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

  async function handleMove(category: Category, direction: "up" | "down") {
    if (!accessToken) return;
    setMoving(category.id);
    try {
      await moveCategory(accessToken, category.id, direction);
      await load();
    } finally {
      setMoving(null);
    }
  }

  const nodes = flattenTree(categories);

  // La lista ya llega ordenada por `order` del backend — alcanza con
  // agrupar por parentId preservando ese orden para saber si un nodo es
  // el primero/último de sus hermanos (deshabilita la flecha en los
  // extremos).
  const siblingsByParent = new Map<string, string[]>();
  for (const c of categories) {
    const key = c.parentId ?? "";
    const list = siblingsByParent.get(key) ?? [];
    list.push(c.id);
    siblingsByParent.set(key, list);
  }

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
            {nodes.map((node) => {
              const siblings = siblingsByParent.get(node.parentId ?? "") ?? [];
              const index = siblings.indexOf(node.id);
              const isFirst = index <= 0;
              const isLast = index === -1 || index === siblings.length - 1;
              const Icon = node.icon ? CATEGORY_ICONS[node.icon] : undefined;

              return (
                <tr key={node.id} className="hover:bg-bg-sunken">
                  <Td className="font-medium">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ paddingLeft: `${node.depth * 20}px` }}
                    >
                      {node.depth > 0 && <span className="text-text-tertiary">└ </span>}
                      {node.imageUrl && (
                        <img
                          src={node.imageUrl}
                          alt=""
                          className="h-6 w-6 flex-none rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                      {node.color && (
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: node.color }}
                          aria-hidden="true"
                        />
                      )}
                      {Icon && <Icon size={14} className="flex-none text-text-secondary" aria-hidden="true" />}
                      <span>
                        {node.name}
                        {node.code && (
                          <span className="ml-1.5 font-mono text-[11px] text-text-tertiary">{node.code}</span>
                        )}
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <Badge variant={node.active ? "success" : "neutral"}>
                      {node.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {canUpdate && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="Subir"
                            disabled={isFirst || moving === node.id}
                            onClick={() => void handleMove(node, "up")}
                            className="rounded p-0.5 text-text-tertiary hover:text-text disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            title="Bajar"
                            disabled={isLast || moving === node.id}
                            onClick={() => void handleMove(node, "down")}
                            className="rounded p-0.5 text-text-tertiary hover:text-text disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      )}
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
              );
            })}
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
