import { User, type UserDocument } from "../../db/models/user.model.js";
import { Role, SYSTEM_ROLES } from "../../db/models/role.model.js";
import { hashPassword } from "../auth/password.js";
import type { CreateTeamUserBody, UpdateTeamUserBody } from "./user.schemas.js";

export class UserError extends Error {
  constructor(
    public code:
      | "not_found"
      | "version_conflict"
      | "duplicate_email"
      | "invalid_role"
      | "cannot_deactivate_self"
      | "cannot_delete_self"
      | "last_admin",
  ) {
    super(code);
  }
}

function toView(doc: UserDocument, roleName: string) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    roleName,
    active: doc.active,
    version: doc.version,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

async function findSystemRole(name: string) {
  return Role.findOne({ name, isSystem: true, companyId: null });
}

/**
 * "Nunca te podés quedar sin administrador": si `target` es el único
 * Admin activo, no se le puede sacar el rol, desactivar, ni borrar.
 * Reusada por `update()` (rol/desactivar) y `delete()`.
 */
async function assertNotLastActiveAdmin(companyId: string, target: UserDocument) {
  const currentRole = await Role.findById(target.roleId);
  if (currentRole?.name !== SYSTEM_ROLES.ADMIN) return;

  const adminRole = await findSystemRole(SYSTEM_ROLES.ADMIN);
  const otherActiveAdmins = await User.countDocuments({
    companyId,
    _id: { $ne: target._id },
    roleId: adminRole!._id,
    active: true,
  });
  if (otherActiveAdmins === 0) throw new UserError("last_admin");
}

export function createUserService() {
  return {
    async list(companyId: string) {
      const docs = await User.find({ companyId }).sort({ name: 1 });
      const roleIds = [...new Set(docs.map((d) => d.roleId.toString()))];
      const roles = await Role.find({ _id: { $in: roleIds } });
      const roleNameById = new Map(roles.map((r) => [r._id.toString(), r.name]));
      return docs.map((d) => toView(d, roleNameById.get(d.roleId.toString()) ?? "?"));
    },

    /**
     * Sin flujo de invitación por email — no hay proveedor de mail
     * configurado (ver docs/13). El Owner/Admin fija la contraseña
     * inicial acá mismo y se la comunica al usuario por fuera del
     * sistema, mismo patrón que ya usa `seed.ts` con el Owner de
     * desarrollo.
     */
    async create(companyId: string, body: CreateTeamUserBody) {
      const role = await findSystemRole(body.roleName);
      if (!role) throw new UserError("invalid_role");

      const passwordHash = await hashPassword(body.password);
      try {
        const doc = await User.create({
          companyId,
          email: body.email.toLowerCase(),
          passwordHash,
          name: body.name,
          roleId: role._id,
          branchRestrictions: [],
        });
        return toView(doc, role.name);
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new UserError("duplicate_email");
        throw err;
      }
    },

    /**
     * Dos guardas de seguridad no obvias (ver docs/13, "Seguridad"): no
     * te podés desactivar a vos mismo desde acá (usá el logout), y no se
     * le puede quitar el rol Admin ni desactivar al único usuario Admin
     * activo que le queda a la empresa — sin esto, una empresa podría
     * quedar sin ningún administrador, sin forma de recuperarse salvo
     * tocando la base a mano. (Owner se fusionó con Admin — ver adenda
     * post-verificación de Fase 13 — así que esta guarda, que antes
     * protegía al último Owner, ahora protege al último Admin.)
     */
    async update(companyId: string, actingUserId: string, id: string, body: UpdateTeamUserBody) {
      const { version, ...fields } = body;
      const target = await User.findOne({ companyId, _id: id });
      if (!target) throw new UserError("not_found");

      const isSelf = id === actingUserId;
      if (isSelf && fields.active === false) throw new UserError("cannot_deactivate_self");

      const currentRole = await Role.findById(target.roleId);
      const willDeactivate = fields.active === false;
      const willChangeAwayFromAdmin = fields.roleName !== undefined && fields.roleName !== SYSTEM_ROLES.ADMIN;
      if (willDeactivate || willChangeAwayFromAdmin) {
        await assertNotLastActiveAdmin(companyId, target);
      }

      const $set: Record<string, unknown> = {};
      if (fields.name !== undefined) $set.name = fields.name;
      if (fields.email !== undefined) $set.email = fields.email.toLowerCase();
      if (fields.active !== undefined) $set.active = fields.active;
      if (fields.password !== undefined) $set.passwordHash = await hashPassword(fields.password);
      let newRoleName = currentRole?.name ?? "?";
      if (fields.roleName !== undefined) {
        const role = await findSystemRole(fields.roleName);
        if (!role) throw new UserError("invalid_role");
        $set.roleId = role._id;
        newRoleName = role.name;
      }

      let doc: UserDocument | null;
      try {
        doc = await User.findOneAndUpdate(
          { companyId, _id: id, version },
          { $set, $inc: { version: 1 } },
          { new: true },
        );
      } catch (err) {
        if (isDuplicateKeyError(err)) throw new UserError("duplicate_email");
        throw err;
      }
      if (!doc) {
        const exists = await User.findOne({ companyId, _id: id });
        throw new UserError(exists ? "version_conflict" : "not_found");
      }
      return toView(doc, newRoleName);
    },

    /**
     * Borrado definitivo, no desactivación — a diferencia de
     * Productos/Categorías/Sucursales, que solo se desactivan (ver
     * docs/13, "Revisión"). Los mismos dos guardas que `update()`: no
     * podés borrarte a vos mismo, ni borrar al único Admin activo que le
     * queda a la empresa. Los movimientos de stock que este usuario haya
     * creado no se tocan — `createdBy` queda apuntando a un id que ya no
     * resuelve a un usuario, el kardex no depende de poder mostrar ese
     * nombre (ver docs/09, adenda de duplicados, mismo patrón de
     * "otro usuario" cuando no se puede resolver).
     */
    async delete(companyId: string, actingUserId: string, id: string) {
      const target = await User.findOne({ companyId, _id: id });
      if (!target) throw new UserError("not_found");

      if (id === actingUserId) throw new UserError("cannot_delete_self");
      await assertNotLastActiveAdmin(companyId, target);

      await User.deleteOne({ companyId, _id: id });
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
