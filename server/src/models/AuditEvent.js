import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  chainKey: { type: String, required: true, index: true }, // tradeId or "SYSTEM"
  seq: { type: Number, required: true },
  ts: { type: String, required: true },
  eventType: { type: String, required: true },
  actor: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  tradeId: { type: String, default: null, index: true },
  queueId: { type: String, default: null },
  tradeDate: { type: String, default: null },
  settlementDate: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  prevHash: { type: String, required: true },
  hash: { type: String, required: true }
}, { versionKey: false });

auditEventSchema.index({ chainKey: 1, seq: 1 }, { unique: true });
auditEventSchema.index({ tradeId: 1, ts: 1 });
auditEventSchema.index({ "actor.userId": 1, ts: -1 });
auditEventSchema.index({ eventType: 1, ts: -1 });

export default mongoose.model("AuditEvent", auditEventSchema);