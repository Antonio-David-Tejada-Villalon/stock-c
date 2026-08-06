import { Branch, type BranchDocument } from "../models/branch.model.js";

export class NoActiveBranchError extends Error {
  constructor() {
    super("no_active_branch");
  }
}

/**
 * Resuelve la única sucursal activa de la empresa — sucursal única
 * implícita (decisión explícita del usuario, ver
 * docs/09-control-inventario.md, sección 2). Falla ruidosamente en vez
 * de elegir "cualquiera" si hay 0 o más de 1 sucursal activa. Compartido
 * entre inventory (Fase 9) y reports (Fase 11) — ambos operan sobre
 * colecciones con `branchId`.
 */
export async function resolveActiveBranch(companyId: string): Promise<BranchDocument> {
  const branches = await Branch.find({ companyId, active: true }).limit(2);
  const [branch] = branches;
  if (branches.length !== 1 || !branch) {
    throw new NoActiveBranchError();
  }
  return branch;
}
