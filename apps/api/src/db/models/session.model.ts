import type { Types } from "mongoose";
import { Schema, model } from "mongoose";

export interface SessionDocument {
  _id: string;
  userId: Types.ObjectId;
  tokenHash: string;
  deviceId: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    tokenHash: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });

export const Session = model<SessionDocument>("Session", sessionSchema);
