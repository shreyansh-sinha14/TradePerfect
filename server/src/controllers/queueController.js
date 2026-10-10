import QueueItem from "../models/QueueItem.js";
import Trade from "../models/Trade.js";
import TradeVersion from "../models/TradeVersion.js";
import { auditService } from "../services/auditService.js";
import { notFound, badRequest, forbidden } from "../utils/AppError.js";

export const queueController = {
  async listQueue(req, res, next) {
    try {
      const { status = "OPEN", priority, search, page = 1, limit = 50 } = req.query;
      const filter = {};

      if (status) filter.status = { $in: status.split(",") };
      if (priority) filter.priority = { $in: priority.split(",") };
      if (search) {
        const clean = search.trim().toUpperCase();
        filter.$or = [
          { queueId: { $regex: "^" + clean } },
          { tradeId: { $regex: "^" + clean } },
          { symbol: { $regex: "^" + clean } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        QueueItem.find(filter)
          .sort({ priorityRank: -1, finalScore: -1, _id: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        QueueItem.countDocuments(filter)
      ]);

      res.status(200).json({
        items: items.map(i => ({
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
          assignee: i.assigneeId ? { userId: i.assigneeId, name: i.assigneeName } : null
        })),
        page: Number(page),
        limit: Number(limit),
        total
      });
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