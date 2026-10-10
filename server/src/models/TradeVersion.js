import mongoose from "mongoose";

const tradeVersionSchema = new mongoose.Schema({
  tradeId: { type: String, required: true },
  version: { type: Number, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  riskStatus: { type: String, required: true },
  finalScore: { type: Number, default: null },
  score: { type: mongoose.Schema.Types.Mixed, default: null },
  changedFields: { type: Array, default: [] },
  changedBy: {
    userId: { type: String, required: true },
    name: { type: String, required: true }
  },
  reason: { type: String, required: true }, // CREATED, UPDATED, FIX_APPLIED
  fixNote: { type: String, default: null }
}, { timestamps: true, versionKey: false });

tradeVersionSchema.index({ tradeId: 1, version: -1 }, { unique: true });

export default mongoose.model("TradeVersion", tradeVersionSchema);