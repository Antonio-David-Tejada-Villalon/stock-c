import type { Category } from "@stock-c/shared-types";

export interface CategoryNode extends Category {
  depth: number;
}

/** Aplana el árbol para mostrarlo indentado en una tabla — el backend
 * entrega la lista plana (ver docs/08, sección 3). */
export function flattenTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string, Category[]>();
  for (const category of categories) {
    const key = category.parentId ?? "";
    const siblings = byParent.get(key) ?? [];
    siblings.push(category);
    byParent.set(key, siblings);
  }

  const result: CategoryNode[] = [];
  function visit(parentKey: string, depth: number, ancestors: Set<string>) {
    const children = byParent.get(parentKey) ?? [];
    for (const child of children) {
      if (ancestors.has(child.id)) continue; // ciclo preexistente ajeno: no colgar en loop
      result.push({ ...child, depth });
      visit(child.id, depth + 1, new Set(ancestors).add(child.id));
    }
  }
  visit("", 0, new Set());
  return result;
}

/** IDs de una categoría y todos sus descendientes — se excluyen de las
 * opciones de "categoría padre" al editarla, para no ofrecer un ciclo
 * obvio desde la UI (el backend igual es la autoridad final). */
export function descendantIds(categories: Category[], id: string): Set<string> {
  const byParent = new Map<string, Category[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }

  const result = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of byParent.get(current) ?? []) {
      if (result.has(child.id)) continue;
      result.add(child.id);
      queue.push(child.id);
    }
  }
  result.delete(id);
  return result;
}
