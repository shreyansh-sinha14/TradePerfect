import mongoose from "mongoose";
import { TRADE_TYPES, RISK_STATUS, PRIORITY, TRADE_SOURCE, AS_OF_MODE } from "@tradeperfect/shared";

const tradeSchema = new mongoose.Schema({
  tradeId: { type: String, required: true, unique: true },
  version: { type: Number, default: 1 },
  tradeType: { type: String, enum: TRADE_TYPES, required: true },
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  counterparty: { type: String, required: true },
  tradeDate: { type: String, required: true },
  settlementDate: { type: String, required: true },
  accountId: { type: String, required: true },
  traderName: { type: String, required: true },
  traderUserId: { type: String, required: true },
  ssiMatched: { type: Boolean, required: true },
  currencyMatched: { type: Boolean, required: true },
  source: { type: String, enum: TRADE_SOURCE, default: "FORM" },
  asOfMode: { type: String, enum: AS_OF_MODE, default: "TODAY" },
  uploadJobId: { type: String, default: null },
  riskStatus: { type: String, enum: RISK_STATUS, default: "PENDING_SCORE" },
  priority: { type: String, enum: PRIORITY, default: null },
  priorityRank: { type: Number, default: 0 },
  riskScore: { type: Number, default: null },
  score: { type: mongoose.Schema.Types.Mixed, default: null },
  rejectionReasons: { type: Array, default: [] },
  queueId: { type: String, default: null },
  queueStatus: { type: String, default: null },
  scoreAttempts: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

tradeSchema.index({ riskStatus: 1, priority: 1, tradeDate: -1 });
tradeSchema.index({ traderUserId: 1, tradeDate: -1 });

export default mongoose.model("Trade", tradeSchema);