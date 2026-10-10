import Trade from "../models/Trade.js";
import TradeVersion from "../models/TradeVersion.js";
import { validationService } from "../services/validationService.js";
import { riskClient } from "../services/riskClient.js";
import { queueService } from "../services/queueService.js";
import { auditService } from "../services/auditService.js";
import { nextId } from "../utils/counters.js";
import { toTradeDTO, toTradeRowDTO } from "../utils/toDto.js";
import { validationFailed, notFound, badRequest } from "../utils/AppError.js";

export const tradeController = {
  validateTrade(req, res) {
    const { data, errors } = validationService.validateFormTrade(req.body);
    if (errors.length > 0) {
      return res.status(200).json({ valid: false, errors });
    }
    return res.status(200).json({ valid: true, errors: [] });
  },

  async createTrade(req, res, next) {
    try {
      const { data, errors } = validationService.validateFormTrade(req.body);
      if (errors.length > 0) {
        await auditService.log({
          eventType: "VALIDATION_FAILED",
          actor: req.user,
          details: { errors, symbol: req.body.symbol, accountId: req.body.accountId }
        });
        return next(validationFailed(errors));
      }

      const tradeId = await nextId("trade", "T", 6);
      const trade = new Trade({
        ...data,
        tradeId,
        traderName: req.user.name,
        traderUserId: req.user.userId,
        source: "FORM",
        asOfMode: "TODAY",
        version: 1
      });

      // Audit submission
      await auditService.log({
        eventType: "TRADE_SUBMITTED",
        actor: req.user,
        tradeId,
        tradeDate: trade.tradeDate,
        settlementDate: trade.settlementDate,
        details: trade.toObject()
      });

      // Score trade via Python risk service
      const scoreRes = await riskClient.scoreTrades([trade], "TODAY", { requestId: req.id });
      riskClient.applyScore(trade, scoreRes.byId.get(tradeId));
      trade.scoreAttempts += 1;

      await trade.save();

      // Audit score if scored successfully
      if (trade.score) {
        await auditService.log({
          eventType: "TRADE_SCORED",
          actor: req.user,
          tradeId,
          tradeDate: trade.tradeDate,
          settlementDate: trade.settlementDate,
          details: {
            finalScore: trade.score.finalScore,
            ruleScore: trade.score.ruleScore,
            mlScore: trade.score.mlScore,
            riskStatus: trade.riskStatus,
            priority: trade.priority,
            scoringMode: trade.score.scoringMode,
            modelVersion: scoreRes.modelVersion,
            ruleConfigVersion: trade.score.ruleConfigVersion
          }
        });
      }

      // Save version snapshot
      await TradeVersion.create({
        tradeId,
        version: 1,
        snapshot: trade.toObject(),
        riskStatus: trade.riskStatus,
        finalScore: trade.riskScore,
        score: trade.score,
        changedBy: { userId: req.user.userId, name: req.user.name },
        reason: "CREATED"
      });

      // Upsert into repair queue if needed
      await queueService.upsertFromScore(trade, { actor: req.user });

      return res.status(201).json(toTradeDTO(trade));
    } catch (err) {
      next(err);
    }
  },

  async getTrade(req, res, next) {
    try {
      const trade = await Trade.findOne({ tradeId: req.params.tradeId }).lean();
      if (!trade) return next(notFound("Trade not found."));

      if (req.user.role === "TRADER" && trade.traderUserId !== req.user.userId) {
        return next(forbidden("You do not have access to this trade."));
      }

      res.status(200).json(toTradeDTO(trade));
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req, res, next) {
    try {
      const trade = await Trade.findOne({ tradeId: req.params.tradeId }).lean();
      if (!trade) return next(notFound("Trade not found."));

      if (req.user.role === "TRADER" && trade.traderUserId !== req.user.userId) {
        return next(forbidden("You do not have access to this trade."));
      }

      const versions = await TradeVersion.find({ tradeId: req.params.tradeId }).sort({ version: -1 }).lean();
      res.status(200).json({
        items: versions.map(v => ({
          version: v.version,
          changedAt: v.createdAt,
          changedBy: v.changedBy,
          reason: v.reason,
          fixNote: v.fixNote,
          changedFields: v.changedFields,
          riskStatus: v.riskStatus,
          finalScore: v.finalScore
        }))
      });
    } catch (err) {
      next(err);
    }
  },

  async listTrades(req, res, next) {
    try {
      const { page = 1, limit = 50, status, priority, q, sort = "tradeDate", order = "desc" } = req.query;
      const filter = {};

      if (req.user.role === "TRADER") {
        filter.traderUserId = req.user.userId;
      }
      if (status) {
        filter.riskStatus = { $in: status.split(",") };
      }
      if (priority) {
        filter.priority = { $in: priority.split(",") };
      }
      if (q) {
        const cleanQ = q.trim().toUpperCase();
        filter.$or = [
          { tradeId: { $regex: "^" + cleanQ } },
          { symbol: { $regex: "^" + cleanQ } }
        ];
      }

      const sortField = sort === "riskScore" ? "riskScore" : sort === "settlementDate" ? "settlementDate" : "tradeDate";
      const sortDirection = order === "asc" ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        Trade.find(filter)
          .sort({ [sortField]: sortDirection, _id: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Trade.countDocuments(filter)
      ]);

      res.status(200).json({
        items: items.map(toTradeRowDTO),
        page: Number(page),
        limit: Number(limit),
        total
      });
    } catch (err) {
      next(err);
    }
  }
};