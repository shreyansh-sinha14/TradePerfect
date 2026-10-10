import QueueItem from "../models/QueueItem.js";
import Trade from "../models/Trade.js";
import TradeVersion from "../models/TradeVersion.js";
import { auditService } from "../services/auditService.js";
import User from "../models/User.js";
import { notFound, badRequest, forbidden, businessRule, validationFailed } from "../utils/AppError.js";
import { queueActions, rejectSchema, zodToDetails, MSG } from "@tradeperfect/shared";
import { toTradeDTO } from "../utils/toDto.js";
import { sendCsv } from "../utils/csv.js";

const ACTIVE = ["OPEN", "IN_PROGRESS"];

// Ops User sees only own items; manager/admin see all (Q/FR-RQ-012)
function buildQueueFilter(user, query) {
  const { status, priority, search } = query;
  const filter = {};
  if (user.role === "OPS_USER") filter.assigneeId = user.userId;
  if (status) filter.status = { $in: String(status).split(",") };
  if (priority) filter.priority = { $in: String(priority).split(",") };
  if (search) {
    const clean = String(search).trim().toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { queueId: { $regex: "^" + clean } },
      { tradeId: { $regex: "^" + clean } },
      { symbol: { $regex: "^" + clean } }
    ];
  }
  return filter;
}

const toQueueDTO = (i) => ({
  queueId: i.queueId,
  tradeId: i.tradeId,
  symbol: i.symbol,
  counterparty: i.counterparty,
  settlementDate: i.settlementDate,
  finalScore: i.finalScore,
  riskStatus: i.riskStatus,
  priority: i.priority,
  status: i.status,
  likelyReason: i.likelyReason,
  suggestedAction: i.suggestedAction,
  assigneeId: i.assigneeId,
  assigneeName: i.assigneeName,
  assignee: i.assigneeId ? { userId: i.assigneeId, name: i.assigneeName } : null,
  assignedAt: i.assignedAt,
  appliedFix: i.appliedFix,
  appliedBy: i.appliedBy,
  appliedAt: i.appliedAt,
  resolution: i.resolution,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt
});

async function markTradeQueueStatus(tradeId, status) {
  await Trade.updateOne({ tradeId }, { $set: { queueStatus: status } });
}

export const queueController = {
  async listQueue(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const filter = buildQueueFilter(req.user, req.query);   // default: all statuses (FR-RQ-001)
      const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
      const [items, total] = await Promise.all([
        QueueItem.find(filter)
          .sort({ priorityRank: -1, finalScore: -1, _id: -1 })
          .skip(skip)
          .limit(lim)
          .lean(),
        QueueItem.countDocuments(filter)
      ]);
      res.status(200).json({ items: items.map(toQueueDTO), page: Number(page), limit: lim, total });
    } catch (err) {
      next(err);
    }
  },

  // GET /queue/stats - top bar counts
  async stats(req, res, next) {
    try {
      const scope = req.user.role === "OPS_USER" ? { assigneeId: req.user.userId } : {};
      const items = await QueueItem.find(scope, { status: 1, priority: 1 }).lean();
      const byStatus = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
      const byPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      for (const i of items) {
        if (i.status in byStatus) byStatus[i.status] += 1;
        if (i.priority in byPriority) byPriority[i.priority] += 1;
      }
      res.status(200).json({ total: items.length, byStatus, byPriority });
    } catch (err) {
      next(err);
    }
  },

  // GET /queue/export.csv (Q/FR-RQ-015)
  async exportQueue(req, res, next) {
    try {
      const items = await QueueItem.find(buildQueueFilter(req.user, req.query))
        .sort({ priorityRank: -1, finalScore: -1, _id: -1 }).limit(10000).lean();
      const header = ["Queue ID", "Trade ID", "Symbol", "Counterparty", "Settlement Date", "Risk Score", "Risk Status",
        "Priority", "Queue Status", "Assignee", "Likely Reason", "Suggested Action", "Applied Fix", "Applied By", "Applied At"];
      const rows = items.map((i) => [i.queueId, i.tradeId, i.symbol, i.counterparty, i.settlementDate, i.finalScore,
        i.riskStatus, i.priority, i.status, i.assigneeName, i.likelyReason, i.suggestedAction,
        i.appliedFix, i.appliedBy, i.appliedAt]);
      sendCsv(res, "repair_queue.csv", header, rows);
    } catch (err) {
      next(err);
    }
  },

  // GET /queue/:queueId -> { item, trade } for the detail drawer and Apply Fix page
  async getQueueItem(req, res, next) {
    try {
      const item = await QueueItem.findOne({ queueId: req.params.queueId }).lean();
      if (!item) return next(notFound("Queue item not found."));
      if (req.user.role === "OPS_USER" && item.assigneeId !== req.user.userId) {
        return next(forbidden(MSG.Q_NOT_ASSIGNED_TO_YOU));
      }
      const trade = await Trade.findOne({ tradeId: item.tradeId }).lean();
      res.status(200).json({ item: toQueueDTO(item), trade: trade ? toTradeDTO(trade) : null });
    } catch (err) {
      next(err);
    }
  },

  // POST /queue/assign { queueIds[], assigneeId } - single or bulk, reassign any time (Q/FR-RQ-005/013)
  async bulkAssign(req, res, next) {
    try {
      const { queueIds, assigneeId } = req.body || {};
      if (!Array.isArray(queueIds) || queueIds.length === 0) return next(badRequest("Select at least one queue item."));
      const assignee = await User.findOne({ userId: assigneeId, role: "OPS_USER", active: true }).lean();
      if (!assignee) return next(businessRule(MSG.Q_ASSIGNEE_INVALID));

      const items = await QueueItem.find({ queueId: { $in: queueIds.map(String) } });
      if (items.length !== queueIds.length) return next(notFound("One or more queue items were not found."));
      const inactive = items.filter((i) => !ACTIVE.includes(i.status)).map((i) => i.queueId);
      if (inactive.length) return next(businessRule(MSG.Q_NOT_ACTIVE, inactive.map((q) => ({ field: "queueIds", message: q }))));

      const now = new Date().toISOString();
      for (const item of items) {
        const reassigned = !!item.assigneeId;
        item.assigneeId = assignee.userId;
        item.assigneeName = assignee.name;
        item.assignedBy = req.user.userId;
        item.assignedAt = now;
        item.status = "IN_PROGRESS";
        await item.save();
        await markTradeQueueStatus(item.tradeId, "IN_PROGRESS");
        await auditService.log({
          eventType: reassigned ? "QUEUE_REASSIGNED" : "QUEUE_ASSIGNED",
          actor: req.user,
          tradeId: item.tradeId,
          queueId: item.queueId,
          details: { assigneeId: assignee.userId, assigneeName: assignee.name }
        });
      }
      res.status(200).json({ updated: items.length, items: items.map((i) => toQueueDTO(i.toObject())) });
    } catch (err) {
      next(err);
    }
  },

  // POST /queue/:queueId/resubmit and POST /queue/resubmit { queueIds[] } (Q/FR-RQ-007/009/010/011)
  async resubmit(req, res, next) {
    try {
      const single = !!req.params.queueId;
      const queueIds = single ? [req.params.queueId] : req.body?.queueIds;
      const note = String(req.body?.note || "").slice(0, 500);
      if (!Array.isArray(queueIds) || queueIds.length === 0) return next(badRequest("Select at least one queue item."));

      const items = await QueueItem.find({ queueId: { $in: queueIds.map(String) } });
      if (items.length !== queueIds.length) return next(notFound("One or more queue items were not found."));
      for (const item of items) {
        if (!ACTIVE.includes(item.status)) return next(businessRule(MSG.Q_NOT_ACTIVE));
        if (item.priority === "HIGH") return next(businessRule(MSG.Q_RESUBMIT_HIGH));
        if (!single && item.priority !== "LOW") return next(businessRule(MSG.Q_BULK_RESUBMIT_LOW));
        if (!queueActions(item, req.user).canResubmit) return next(forbidden(MSG.Q_NOT_ASSIGNED_TO_YOU));
      }

      const now = new Date().toISOString();
      for (const item of items) {
        item.status = "RESOLVED";
        item.resolution = { type: "RESUBMITTED", note, by: req.user.userId, byName: req.user.name, at: now,
          feedbackLabel: "FALSE_POSITIVE" };   // kept for future retraining (plan 9.1)
        await item.save();
        await markTradeQueueStatus(item.tradeId, "RESOLVED");
        const common = { actor: req.user, tradeId: item.tradeId, queueId: item.queueId };
        await auditService.log({ ...common, eventType: "TRADE_RESUBMITTED", details: { note, priority: item.priority } });
        await auditService.log({ ...common, eventType: "QUEUE_RESOLVED",
          details: { resolutionType: "RESUBMITTED", note, feedbackLabel: "FALSE_POSITIVE" } });
      }
      res.status(200).json({ updated: items.length, items: items.map((i) => toQueueDTO(i.toObject())) });
    } catch (err) {
      next(err);
    }
  },

  // POST /queue/:queueId/reject { reason } - HIGH only, reason required (Q/FR-RQ-008)
  async reject(req, res, next) {
    try {
      const parsed = rejectSchema.safeParse(req.body || {});
      if (!parsed.success) return next(validationFailed(zodToDetails(parsed.error)));
      const item = await QueueItem.findOne({ queueId: req.params.queueId });
      if (!item) return next(notFound("Queue item not found."));
      if (!ACTIVE.includes(item.status)) return next(businessRule(MSG.Q_NOT_ACTIVE));
      if (item.priority !== "HIGH") return next(businessRule(MSG.Q_REJECT_NOT_HIGH));
      if (!queueActions(item, req.user).canReject) return next(forbidden(MSG.Q_NOT_ASSIGNED_TO_YOU));

      item.status = "REJECTED";
      item.resolution = { type: "CANCELLED", note: parsed.data.reason, by: req.user.userId, byName: req.user.name,
        at: new Date().toISOString() };
      await item.save();
      await markTradeQueueStatus(item.tradeId, "REJECTED");
      await auditService.log({ eventType: "QUEUE_REJECTED", actor: req.user, tradeId: item.tradeId,
        queueId: item.queueId, details: { reason: parsed.data.reason } });
      res.status(200).json({ updated: 1, items: [toQueueDTO(item.toObject())] });
    } catch (err) {
      next(err);
    }
  },

  async assignQueue(req, res, next) {
    try {
      const { queueId } = req.params;
      const { assigneeId, assigneeName } = req.body;

      const item = await QueueItem.findOne({ queueId });
      if (!item) return next(notFound("Queue item not found."));

      item.assigneeId = assigneeId || req.user.userId;
      item.assigneeName = assigneeName || req.user.name;
      item.assignedBy = req.user.userId;
      item.assignedAt = new Date().toISOString();
      item.status = "IN_PROGRESS";
      await item.save();

      await auditService.log({
        eventType: "QUEUE_ASSIGNED",
        actor: req.user,
        tradeId: item.tradeId,
        queueId,
        details: { assigneeId: item.assigneeId, assigneeName: item.assigneeName }
      });

      res.status(200).json({ status: "success", queueId, assignee: { userId: item.assigneeId, name: item.assigneeName } });
    } catch (err) {
      next(err);
    }
  },

  async resolveQueue(req, res, next) {
    try {
      const { queueId } = req.params;
      const { resolutionType, note, feedbackLabel } = req.body;

      const item = await QueueItem.findOne({ queueId });
      if (!item) return next(notFound("Queue item not found."));

      item.status = "RESOLVED";
      item.resolution = {
        type: resolutionType || "MANUAL_OVERRIDE",
        note: note || "",
        by: req.user.userId,
        byName: req.user.name,
        at: new Date().toISOString(),
        feedbackLabel: feedbackLabel || null
      };
      await item.save();

      // Update trade status if resolved
      const trade = await Trade.findOne({ tradeId: item.tradeId });
      if (trade) {
        trade.queueStatus = "RESOLVED";
        await trade.save();
      }

      await auditService.log({
        eventType: "QUEUE_RESOLVED",
        actor: req.user,
        tradeId: item.tradeId,
        queueId,
        details: { resolutionType, note, feedbackLabel }
      });

      res.status(200).json({ status: "success", queueId, queueStatus: "RESOLVED" });
    } catch (err) {
      next(err);
    }
  }
};