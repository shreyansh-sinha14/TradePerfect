import mongoose from "mongoose";
import { QUEUE_STATUS, PRIORITY } from "@tradeperfect/shared";

const queueItemSchema = new mongoose.Schema({
  queueId: { type: String, required: true, unique: true },
  tradeId: { type: String, required: true, unique: true },
  symbol: { type: String, required: true },
  counterparty: { type: String, required: true },
  settlementDate: { type: String, required: true },
  finalScore: { type: Number, required: true },
  riskStatus: { type: String, required: true },
  priority: { type: String, enum: PRIORITY, required: true },
  priorityRank: { type: Number, required: true },
  status: { type: String, enum: QUEUE_STATUS, default: "OPEN" },
  likelyReason: { type: String },
  suggestedAction: { type: String },
  assigneeId: { type: String, default: null },
  assigneeName: { type: String, default: null },
  assignedBy: { type: String, default: null },
  assignedAt: { type: String, default: null },
  appliedFix: { type: String, default: null },
  appliedBy: { type: String, default: null },
  appliedAt: { type: String, default: null },
  resolution: {
    type: { type: String },
    note: { type: String },
    by: { type: String },
    byName: { type: String },
    at: { type: String },
    feedbackLabel: { type: String }
  }
}, { timestamps: true, versionKey: false });

queueItemSchema.index({ status: 1, priorityRank: -1, finalScore: -1 });
queueItemSchema.index({ assigneeId: 1, status: 1, priorityRank: -1 });

export default mongoose.model("QueueItem", queueItemSchema);