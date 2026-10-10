import AuditEvent from "../models/AuditEvent.js";
import Trade from "../models/Trade.js";
import QueueItem from "../models/QueueItem.js";
import { auditService } from "../services/auditService.js";
import { badRequest, forbidden, notFound } from "../utils/AppError.js";
import { sendCsv } from "../utils/csv.js";

const toEventDTO = (e) => ({
  eventId: e.eventId,
  seq: e.seq,
  timestamp: e.ts,
  eventType: e.eventType,
  actor: e.actor,
  tradeId: e.tradeId,
  queueId: e.queueId,
  tradeDate: e.tradeDate,
  settlementDate: e.settlementDate,
  details: e.details
});

// Ops User may only read the audit of trades assigned to them (plan M-01 role matrix)
async function assertTradeAuditAccess(user, tradeId) {
  if (user.role !== "OPS_USER") return;
  const item = await QueueItem.findOne({ tradeId, assigneeId: user.userId }, { _id: 1 }).lean();
  if (!item) throw forbidden("This trade is not assigned to you.");
}

// FR-AT-002: Trade ID, date range on trade date or settlement date, user, event type
async function buildAuditFilter(query) {
  const { tradeId, from, to, dateField = "tradeDate", userId, eventType } = query;
  const filter = {};
  if (tradeId) filter.tradeId = String(tradeId).trim().toUpperCase();
  if (userId) filter["actor.userId"] = String(userId);
  if (eventType) filter.eventType = { $in: String(eventType).split(",") };
  if (from || to) {
    const field = dateField === "settlementDate" ? "settlementDate" : "tradeDate";
    const range = {};
    if (from) range.$gte = String(from);
    if (to) range.$lte = String(to);
    const ids = await Trade.find({ [field]: range }, { tradeId: 1 }).lean();
    const inRange = ids.map((t) => t.tradeId);
    filter.tradeId = filter.tradeId
      ? (inRange.includes(filter.tradeId) ? filter.tradeId : "__none__")
      : { $in: inRange };
  }
  return filter;
}

// FR-AT-006/007 columns, built from the trade + its queue item
async function latestSnapshot(tradeId) {
  const trade = await Trade.findOne({ tradeId }).lean();
  if (!trade) return null;
  const item = trade.queueId ? await QueueItem.findOne({ queueId: trade.queueId }).lean() : null;
  return {
    tradeId: trade.tradeId,
    queueId: trade.queueId,
    riskScore: trade.riskScore,
    likelyReason: trade.score?.likelyReason ?? null,
    recommendedFix: trade.score?.suggestedAction ?? null,
    appliedFix: item?.appliedFix ?? null,
    appliedBy: item?.appliedBy ?? item?.resolution?.byName ?? null,
    appliedTimestamp: item?.appliedAt ?? item?.resolution?.at ?? null,
    status: item?.status ?? trade.riskStatus
  };
}

export const auditController = {
  async search(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const filter = await buildAuditFilter(req.query);
      const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
      const [items, total] = await Promise.all([
        AuditEvent.find(filter).sort({ ts: -1, _id: -1 }).skip(skip).limit(lim).lean(),
        AuditEvent.countDocuments(filter)
      ]);
      res.status(200).json({ items: items.map(toEventDTO), page: Number(page), limit: lim, total });
    } catch (err) {
      next(err);
    }
  },

  // FR-AT-001 lifecycle timeline, oldest first
  async timeline(req, res, next) {
    try {
      const tradeId = req.params.tradeId.toUpperCase();
      await assertTradeAuditAccess(req.user, tradeId);
      const items = await AuditEvent.find({ chainKey: tradeId }).sort({ seq: 1 }).lean();
      res.status(200).json({ tradeId, items: items.map(toEventDTO) });
    } catch (err) {
      next(err);
    }
  },

  // FR-AT-007 latest audit box
  async latest(req, res, next) {
    try {
      const tradeId = req.params.tradeId.toUpperCase();
      await assertTradeAuditAccess(req.user, tradeId);
      const snap = await latestSnapshot(tradeId);
      if (!snap) return next(notFound("Trade not found."));
      res.status(200).json(snap);
    } catch (err) {
      next(err);
    }
  },

  // FR-AT-005: recompute the hash chain of one trade
  async verify(req, res, next) {
    try {
      const { tradeId } = req.query;
      if (!tradeId) return next(badRequest("tradeId is required."));
      res.status(200).json(await auditService.verify(String(tradeId).toUpperCase()));
    } catch (err) {
      next(err);
    }
  },

  // FR-AT-006: one row per trade found by the current search
  async exportCsv(req, res, next) {
    try {
      const filter = await buildAuditFilter(req.query);
      const tradeIds = (await AuditEvent.distinct("tradeId", filter)).filter(Boolean).slice(0, 10000);
      const header = ["Trade ID", "Queue ID", "Risk Score", "Likely Reason", "Recommended Fix", "Applied Fix",
        "Applied By", "Applied Timestamp", "Status"];
      const rows = [];
      for (const id of tradeIds) {
        const s = await latestSnapshot(id);
        if (s) rows.push([s.tradeId, s.queueId, s.riskScore, s.likelyReason, s.recommendedFix, s.appliedFix,
          s.appliedBy, s.appliedTimestamp, s.status]);
      }
      sendCsv(res, "audit.csv", header, rows);
    } catch (err) {
      next(err);
    }
  }
};
