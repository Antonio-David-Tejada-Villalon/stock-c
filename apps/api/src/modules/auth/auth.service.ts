import type { FastifyInstance } from "fastify";
import { User } from "../../db/models/user.model.js";
import { Role } from "../../db/models/role.model.js";
import { Session } from "../../db/models/session.model.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "./tokens.js";
import type { AccessTokenPayload } from "../../plugins/jwt.js";

export class AuthError extends Error {
  constructor(public code: "invalid_credentials" | "invalid_refresh" | "account_disabled") {
    super(code);
  }
}

export interface AuthUserView {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: { id: string; name: string; permissions: string[] };
  branchRestrictions: string[];
}

async function loadUserView(userId: string): Promise<AuthUserView | null> {
  const user = await User.findOne({ _id: userId }).setOptions({ allowCrossTenant: true });
  if (!user) return null;
  const role = await Role.findById(user.roleId);
  if (!role) return null;
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    companyId: user.companyId.toString(),
    role: { id: role._id.toString(), name: role.name, permissions: role.permissions },
    branchRestrictions: user.branchRestrictions.map((id) => id.toString()),
  };
}

export function createAuthService(app: FastifyInstance) {
  return {
    /**
     * Busca por email sin companyId (única excepción explícita del
     * plugin de tenant) porque el login todavía no sabe a qué empresa
     * pertenece el usuario — ver nota en tenantScope.ts.
     */
    async login(email: string, password: string) {
      const user = await User.findOne({ email: email.toLowerCase() })
        .select("+passwordHash")
        .setOptions({ allowCrossTenant: true });

      if (!user) {
        // Hashear igual una contraseña "dummy" para no filtrar por timing
        // si el email existe o no.
        await hashPassword(password).catch(() => undefined);
        throw new AuthError("invalid_credentials");
      }
      if (!user.active) {
        throw new AuthError("account_disabled");
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        throw new AuthError("invalid_credentials");
      }

      const role = await Role.findById(user.roleId);
      if (!role) {
        throw new AuthError("account_disabled");
      }

      user.lastLoginAt = new Date();
      await user.save();

      const accessToken = await this.signAccessToken({
        sub: user._id.toString(),
        companyId: user.companyId.toString(),
        roleId: role._id.toString(),
        permissions: role.permissions,
      });
      const { refreshToken, expiresAt } = await this.issueRefreshToken(
        user._id.toString(),
        "web",
      );

      const view = await loadUserView(user._id.toString());
      return { accessToken, refreshToken, refreshExpiresAt: expiresAt, user: view! };
    },

    async signAccessToken(payload: AccessTokenPayload) {
      return app.jwt.sign(payload);
    },

    async issueRefreshToken(userId: string, deviceId: string) {
      const refreshToken = generateRefreshToken();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
      await Session.create({
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        deviceId,
        expiresAt,
      });
      return { refreshToken, expiresAt };
    },

    /** Rota el refresh token: revoca el anterior y emite uno nuevo. */
    async refresh(rawToken: string) {
      const tokenHash = hashRefreshToken(rawToken);
      const session = await Session.findOne({ tokenHash });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        if (session?.revokedAt) {
          // Reuso de un refresh token ya rotado: posible robo. Se
          // revocan todas las sesiones del usuario como precaución.
          await Session.updateMany(
            { userId: session.userId, revokedAt: { $exists: false } },
            { $set: { revokedAt: new Date() } },
          );
        }
        throw new AuthError("invalid_refresh");
      }

      session.revokedAt = new Date();
      await session.save();

      const view = await loadUserView(session.userId.toString());
      if (!view) throw new AuthError("invalid_refresh");

      const accessToken = await this.signAccessToken({
        sub: view.id,
        companyId: view.companyId,
        roleId: view.role.id,
        permissions: view.role.permissions,
      });
      const { refreshToken, expiresAt } = await this.issueRefreshToken(
        view.id,
        session.deviceId,
      );

      return { accessToken, refreshToken, refreshExpiresAt: expiresAt, user: view };
    },

    async logout(rawToken: string) {
      const tokenHash = hashRefreshToken(rawToken);
      await Session.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
    },

    async me(userId: string) {
      return loadUserView(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
