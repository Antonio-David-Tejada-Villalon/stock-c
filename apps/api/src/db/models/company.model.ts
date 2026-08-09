import { Schema, model } from "mongoose";

export interface CompanyDocument {
  _id: string;
  name: string;
  slug: string;
  taxId?: string;
  settings: {
    timezone: string;
    currency: string;
    /** Sobrescribe `--accent` en runtime (Fase 13) — validado por
     * contraste WCAG al guardar, ver lib/contrast.ts. */
    accentColor?: string;
    /** Solo URL — sin object storage configurado, mismo criterio que
     * `imageUrl` de Categorías. */
    logoUrl?: string;
    faviconUrl?: string;
  };
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<CompanyDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    taxId: { type: String, trim: true },
    settings: {
      timezone: { type: String, required: true, default: "America/Argentina/Buenos_Aires" },
      currency: { type: String, required: true, default: "ARS" },
      accentColor: { type: String, trim: true },
      logoUrl: { type: String, trim: true, maxlength: 2000 },
      faviconUrl: { type: String, trim: true, maxlength: 2000 },
    },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Company = model<CompanyDocument>("Company", companySchema);
