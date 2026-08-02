import { Schema, model } from "mongoose";

export interface CompanyDocument {
  _id: string;
  name: string;
  slug: string;
  taxId?: string;
  settings: {
    timezone: string;
    currency: string;
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
    },
    active: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Company = model<CompanyDocument>("Company", companySchema);
