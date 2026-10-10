import Trade from "../models/Trade.js";
import { riskClient } from "./riskClient.js";
import { queueService } from "./queueService.js";
import { auditService } from "./auditService.js";

const SYSTEM = { userId: "system", name: "System", role: "SYSTEM" };
let running = false;

// Fail-safe (plan 4.4): trades saved as PENDING_SCORE while the risk service was down
// are re-scored here every 30 s, so they are never silently left unscored.
export async function rescorePending() {
  if (running) return;
  running = true;
  try {
    const pending = await Trade.find({ riskStatus: "PENDING_SCORE" }).sort({ createdAt: 1 }).limit(1000);
    if (pending.length === 0) return;

    for (const mode of ["TODAY", "TRADE_DATE"]) {
      const batch = pending.filter((t) => (t.asOfMode || "TODAY") === mode);
      if (batch.length === 0) continue;
      const res = await riskClient.scoreTrades(batch, mode, { bulk: true, requestId: "rescore-job" });
      if (!res.ok) return;   // still down - try again next tick

      for (const trade of batch) {
        const result = res.byId.get(trade.tradeId);
        if (!result) continue;
        riskClient.applyScore(trade, result);
        trade.scoreAttempts += 1;
        await trade.save();
        await auditService.log({
          eventType: "TRADE_SCORED",
          actor: SYSTEM,
          tradeId: trade.tradeId,
          tradeDate: trade.tradeDate,
          settlementDate: trade.settlementDate,
          details: {
            finalScore: trade.score.finalScore, ruleScore: trade.score.ruleScore, mlScore: trade.score.mlScore,
            riskStatus: trade.riskStatus, priority: trade.priority, scoringMode: trade.score.scoringMode,
            modelVersion: res.modelVersion, ruleConfigVersion: trade.score.ruleConfigVersion, retry: true
          }
        });
        await queueService.upsertFromScore(trade, { actor: SYSTEM });
      }
      console.log(`Re-scored ${batch.length} PENDING_SCORE trade(s).`);
    }
  } catch (err) {
    console.error("Re-score job failed:", err.message);
  } finally {
    running = false;
  }
}

export function startRescoreJob(intervalMs = Number(process.env.RESCORE_INTERVAL_MS) || 30000) {
  setInterval(rescorePending, intervalMs);
}
