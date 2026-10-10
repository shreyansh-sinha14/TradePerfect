import Trade from "../models/Trade.js";
import TradeVersion from "../models/TradeVersion.js";
import { validationService } from "../services/validationService.js";
import { riskClient } from "../services/riskClient.js";
import { queueService } from "../services/queueService.js";
import { auditService } from "../services/auditService.js";
import { nextId } from "../utils/counters.js";
import { toTradeDTO, toTradeRowDTO } from "../utils/toDto.js";
import { validationFailed, notFound, badRequest, forbidden, businessRule } from "../utils/AppError.js";
import QueueItem from "../models/QueueItem.js";
import { checkMasterData } from "../services/validationService.js";
import { tradeUpdateSchema, zodToDetails, canEditTrade, MSG } from "@tradeperfect/shared";
import { sendCsv } from "../utils/csv.js";

const EDITABLE_FIELDS = ["tradeType", "symbol", "quantity", "price", "counterparty", "tradeDate",
  "settlementDate", "accountId", "ssiMatched", "currencyMatched"];

// Same filters for the dashboard grid and its CSV export (FR-RQ-004/005/006)
function buildTradeFilter(user, query) {
  const { status, priority, q, tradeDateFrom, tradeDateTo, settleFrom, settleTo } = query;
  const filter = {};
  if (user.role === "TRADER") filter.traderUserId = user.userId;
  if (status) filter.riskStatus = { $in: String(status).split(",") };
  if (priority) filter.priority = { $in: String(priority).split(",") };
  if (tradeDateFrom || tradeDateTo) {
    filter.tradeDate = {};
    if (tradeDateFrom) filter.tradeDate.$gte = String(tradeDateFrom);
    if (tradeDateTo) filter.tradeDate.$lte = String(tradeDateTo);
  }
  if (settleFrom || settleTo) {
    filter.settlementDate = {};
    if (settleFrom) filter.settlementDate.$gte = String(settleFrom);
    if (settleTo) filter.settlementDate.$lte = String(settleTo);
  }
  if (q) {
    const cleanQ = String(q).trim().toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { tradeId: { $regex: "^" + cleanQ } },
      { symbol: { $regex: "^" + cleanQ } }
    ];
  }
  return filter;
}

export const tradeController = {
  validateTrade(req, res) {
    // Update / Apply Fix forms also send read-only or fix-only fields; the dry run checks trade fields only
    const { tradeId: _id, traderName: _n, queueId: _q, fixNote: _f, ...body } = req.body || {};
    const { data, errors } = validationService.validateFormTrade(body);
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
      const { page = 1, limit = 50, sort = "tradeDate", order = "desc" } = req.query;
      const filter = buildTradeFilter(req.user, req.query);

      const sortField = sort === "riskScore" ? "riskScore" : sort === "settlementDate" ? "settlementDate" : "tradeDate";
      const sortDirection = order === "asc" ? 1 : -1;

      const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
      const [items, total] = await Promise.all([
        Trade.find(filter)
          .sort({ [sortField]: sortDirection, _id: -1 })
          .skip(skip)
          .limit(lim)
          .lean(),
        Trade.countDocuments(filter)
      ]);

      res.status(200).json({
        items: items.map(toTradeRowDTO),
        page: Number(page),
        limit: lim,
        total
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /trades/export.csv (FR-RQ-006) - same filters as the grid
  async exportTrades(req, res, next) {
    try {
      const filter = buildTradeFilter(req.user, req.query);
      const items = await Trade.find(filter).sort({ tradeDate: -1, _id: -1 }).limit(10000).lean();
      const header = ["Trade ID", "Queue ID", "Symbol", "Counterparty", "Trade Date", "Settlement Date",
        "Risk Score", "Status", "Priority", "Likely Reason", "Suggested Action", "Risk Factors %", "Explanation"];
      const rows = items.map((t) => [
        t.tradeId, t.queueId, t.symbol, t.counterparty, t.tradeDate, t.settlementDate,
        t.riskScore, t.riskStatus, t.priority, t.score?.likelyReason, t.score?.suggestedAction,
        (t.score?.riskFactors || []).map((f) => `${f.factor} ${f.pct}%`).join("; "),
        t.score?.explanation
      ]);
      sendCsv(res, "trades.csv", header, rows);
    } catch (err) {
      next(err);
    }
  },

  // PUT /trades/:tradeId - new version + re-score; with queueId it is "Apply Fix" (FR-TB-011, Q/FR-RQ-006)
  async updateTrade(req, res, next) {
    try {
      const trade = await Trade.findOne({ tradeId: req.params.tradeId });
      if (!trade) return next(notFound("Trade not found."));
      if (trade.riskStatus === "REJECTED") return next(businessRule(MSG.T_REJECTED_READONLY));
      if (trade.queueStatus === "REJECTED") return next(businessRule(MSG.T_CANCELLED));

      const queueItem = trade.queueId ? await QueueItem.findOne({ queueId: trade.queueId }).lean() : null;
      if (!canEditTrade(trade, req.user, queueItem)) {
        return next(forbidden("You cannot edit this trade with your current role or queue assignment."));
      }

      // tradeId / traderName are read-only form fields; ignore them if the form sends them
      const { tradeId: _ignoreId, traderName: _ignoreName, ...body } = req.body || {};
      const parsed = tradeUpdateSchema.safeParse(body);
      if (!parsed.success) return next(validationFailed(zodToDetails(parsed.error)));
      const masterErrors = checkMasterData(parsed.data);
      if (masterErrors.length) return next(validationFailed(masterErrors));

      const { queueId, fixNote, ...fields } = parsed.data;
      const isFix = !!queueId;
      if (isFix) {
        if (!queueItem || queueItem.queueId !== queueId) return next(badRequest("Queue ID does not belong to this trade."));
        if (!["OPEN", "IN_PROGRESS"].includes(queueItem.status)) return next(businessRule(MSG.Q_NOT_ACTIVE));
      }

      const changedFields = EDITABLE_FIELDS
        .filter((f) => String(trade[f]) !== String(fields[f]))
        .map((f) => ({ field: f, from: trade[f], to: fields[f] }));
      if (changedFields.length === 0) return next(businessRule("No fields were changed."));

      const before = { riskStatus: trade.riskStatus, riskScore: trade.riskScore };
      Object.assign(trade, fields);
      trade.version += 1;

      const scoreRes = await riskClient.scoreTrades([trade], trade.asOfMode || "TODAY", { requestId: req.id });
      riskClient.applyScore(trade, scoreRes.byId.get(trade.tradeId));
      trade.scoreAttempts += 1;
      await trade.save();

      const appliedFix = changedFields.map((c) => `${c.field}: ${c.from} → ${c.to}`).join(", ");
      const common = { actor: req.user, tradeId: trade.tradeId, queueId: trade.queueId,
        tradeDate: trade.tradeDate, settlementDate: trade.settlementDate };

      await auditService.log({ ...common, eventType: "TRADE_UPDATED",
        details: { version: trade.version, changedFields } });
      if (isFix) {
        await auditService.log({ ...common, eventType: "FIX_APPLIED",
          details: { appliedFix, appliedFields: changedFields.map((c) => c.field), fixNote: fixNote || null,
            riskScoreBefore: before.riskScore, riskScoreAfter: trade.riskScore } });
      }
      if (trade.score) {
        await auditService.log({ ...common, eventType: "TRADE_SCORED",
          details: { finalScore: trade.score.finalScore, ruleScore: trade.score.ruleScore, mlScore: trade.score.mlScore,
            riskStatus: trade.riskStatus, priority: trade.priority, scoringMode: trade.score.scoringMode,
            modelVersion: scoreRes.modelVersion, ruleConfigVersion: trade.score.ruleConfigVersion } });
      }

      await TradeVersion.create({
        tradeId: trade.tradeId,
        version: trade.version,
        snapshot: trade.toObject(),
        riskStatus: trade.riskStatus,
        finalScore: trade.riskScore,
        score: trade.score,
        changedFields,
        changedBy: { userId: req.user.userId, name: req.user.name },
        reason: isFix ? "FIX_APPLIED" : "UPDATED",
        fixNote: fixNote || null
      });

      const statusBefore = queueItem?.status;
      await queueService.upsertFromScore(trade, { actor: req.user, fix: isFix ? { appliedFix, fixNote } : undefined });
      if (isFix && trade.queueStatus === "RESOLVED" && statusBefore !== "RESOLVED") {
        await auditService.log({ ...common, eventType: "QUEUE_RESOLVED",
          details: { resolutionType: "FIXED", note: fixNote || null } });
      }

      return res.status(200).json(toTradeDTO(trade));
    } catch (err) {
      next(err);
    }
  }
};
