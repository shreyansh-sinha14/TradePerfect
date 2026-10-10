import QueueItem from "../models/QueueItem.js";
import { nextId } from "../utils/counters.js";
import { auditService } from "./auditService.js";

export const queueService = {
  async upsertFromScore(trade, { actor, fix } = {}) {
    if (["REJECTED", "PENDING_SCORE"].includes(trade.riskStatus)) {
      return;
    }

    const score = trade.riskScore;
    const pr = trade.priority;
    const minScore = Number(process.env.QUEUE_MIN_SCORE) || 0;
    const autoResolveLow = process.env.QUEUE_AUTO_RESOLVE_LOW === "true";

    let item = await QueueItem.findOne({ tradeId: trade.tradeId });

    if (!item) {
      if (score <= minScore && !["HIGH", "MEDIUM"].includes(pr)) {
        return;
      }
      const isAutoResolved = autoResolveLow && pr === "LOW";
      const queueId = await nextId("queue", "Q", 6);

      item = new QueueItem({
        queueId,
        tradeId: trade.tradeId,
        symbol: trade.symbol,
        counterparty: trade.counterparty,
        settlementDate: trade.settlementDate,
        finalScore: score,
        riskStatus: trade.riskStatus,
        priority: pr,
        priorityRank: trade.priorityRank,
        status: isAutoResolved ? "RESOLVED" : "OPEN",
        likelyReason: trade.score?.likelyReason,
        suggestedAction: trade.score?.suggestedAction,
        resolution: isAutoResolved ? { type: "AUTO_LOW", at: new Date().toISOString() } : null
      });

      await item.save();
      await auditService.log({
        eventType: "QUEUE_CREATED",
        actor: actor || { userId: "system", name: "System", role: "SYSTEM" },
        tradeId: trade.tradeId,
        queueId,
        tradeDate: trade.tradeDate,
        settlementDate: trade.settlementDate,
        details: { priority: pr, finalScore: score }
      });
    } else {
      item.finalScore = score;
      item.riskStatus = trade.riskStatus;
      item.priority = pr;
      item.priorityRank = trade.priorityRank;
      item.likelyReason = trade.score?.likelyReason;
      item.suggestedAction = trade.score?.suggestedAction;
      item.settlementDate = trade.settlementDate;

      if (fix) {
        item.appliedFix = fix.appliedFix;
        item.appliedBy = actor?.name;
        item.appliedAt = new Date().toISOString();
        if (pr === "LOW" || score <= minScore) {
          item.status = "RESOLVED";
          item.resolution = {
            type: "FIXED",
            note: fix.fixNote,
            by: actor?.userId,
            byName: actor?.name,
            at: new Date().toISOString()
          };
        }
      }
      await item.save();
    }

    trade.queueId = item.queueId;
    trade.queueStatus = item.status;
    await trade.save();
  }
};