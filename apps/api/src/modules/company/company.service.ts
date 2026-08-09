import { Company, type CompanyDocument } from "../../db/models/company.model.js";
import { passesAA } from "../../lib/contrast.js";
import type { UpdateCompanyBody } from "./company.schemas.js";

export class CompanyError extends Error {
  constructor(
    public code: "not_found" | "version_conflict" | "invalid_contrast",
    public detail?: string,
  ) {
    super(code);
  }
}

function toView(doc: CompanyDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    taxId: doc.taxId,
    settings: {
      timezone: doc.settings.timezone,
      currency: doc.settings.currency,
      accentColor: doc.settings.accentColor,
      logoUrl: doc.settings.logoUrl,
      faviconUrl: doc.settings.faviconUrl,
    },
    version: doc.version,
  };
}

export function createCompanyService() {
  return {
    /** Sin `list`: la empresa es un singleton por tenant, `companyId`
     * sale del token — no hace falta un endpoint de búsqueda. */
    async get(companyId: string) {
      const doc = await Company.findOne({ _id: companyId });
      if (!doc) throw new CompanyError("not_found");
      return toView(doc);
    },

    async update(companyId: string, body: UpdateCompanyBody) {
      const { version, settings, ...fields } = body;
      const $set: Record<string, unknown> = {};
      const $unset: Record<string, ""> = {};

      if (fields.name !== undefined) $set.name = fields.name;
      if ("taxId" in fields) {
        if (fields.taxId === null) $unset.taxId = "";
        else if (fields.taxId !== undefined) $set.taxId = fields.taxId;
      }

      if (settings) {
        if (settings.timezone !== undefined) $set["settings.timezone"] = settings.timezone;
        if (settings.currency !== undefined) $set["settings.currency"] = settings.currency;
        // Validación de contraste WCAG (ver lib/contrast.ts y docs/13,
        // sección "Justificación técnica") — autoridad del lado del
        // servidor, el cliente solo da feedback en vivo.
        if ("accentColor" in settings) {
          if (settings.accentColor === null) {
            $unset["settings.accentColor"] = "";
          } else if (settings.accentColor !== undefined) {
            const { ok, bestRatio } = passesAA(settings.accentColor);
            if (!ok) throw new CompanyError("invalid_contrast", bestRatio.toFixed(2));
            $set["settings.accentColor"] = settings.accentColor;
          }
        }
        if ("logoUrl" in settings) {
          if (settings.logoUrl === null) $unset["settings.logoUrl"] = "";
          else if (settings.logoUrl !== undefined) $set["settings.logoUrl"] = settings.logoUrl;
        }
        if ("faviconUrl" in settings) {
          if (settings.faviconUrl === null) $unset["settings.faviconUrl"] = "";
          else if (settings.faviconUrl !== undefined) $set["settings.faviconUrl"] = settings.faviconUrl;
        }
      }

      const doc = await Company.findOneAndUpdate(
        { _id: companyId, version },
        { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}), $inc: { version: 1 } },
        { new: true },
      );
      if (!doc) {
        const exists = await Company.findOne({ _id: companyId });
        throw new CompanyError(exists ? "version_conflict" : "not_found");
      }
      return toView(doc);
    },
  };
}

export type CompanyService = ReturnType<typeof createCompanyService>;
