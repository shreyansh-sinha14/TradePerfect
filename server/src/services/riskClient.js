import axios from "axios";
import { PRIORITY_RANK } from "@tradeperfect/shared";
import pino from "pino";

const logger = pino();

export const riskClient = {
  async scoreTrades(trades, asOfMode, { bulk = false, requestId } = {}) {
    const riskUrl = process.env.RISK_URL || "http://localhost:8000";
    const internalKey = process.env.INTERNAL_KEY || "";
    const singleTimeout = Number(process.env.RISK_TIMEOUT_SINGLE_MS) || 5000;
    const bulkTimeout = Number(process.env.RISK_TIMEOUT_BULK_MS) || 60000;

    const toScoreInput = (t) => ({
      tradeId: t.tradeId,
      tradeType: t.tradeType,
      symbol: t.symbol,
      quantity: t.quantity,
      price: t.price,
      counterparty: t.counterparty,
      tradeDate: t.tradeDate,
      settlementDate: t.settlementDate,
      accountId: t.accountId,
      traderName: t.traderName,
      ssiMatched: t.ssiMatched,
      currencyMatched: t.currencyMatched
    });

    try {
      const res = await axios.post(`${riskUrl}/internal/v1/score`,
        { asOfMode, trades: trades.map(toScoreInput) },
        {
          timeout: bulk ? bulkTimeout : singleTimeout,
          headers: { "X-Internal-Key": internalKey, "X-Request-Id": requestId || "req-risk" }
        }
      );
      const byId = new Map(res.data.results.map((r) => [r.tradeId, r]));
      return { ok: true, byId, modelVersion: res.data.modelVersion };
    } catch (err) {
      logger.warn({ err: err.message }, "Risk service failed or timed out -> setting PENDING_SCORE");
      return { ok: false, byId: new Map() };
    }
  },

  applyScore(tradeDoc, result) {
    if (!result) {
      Object.assign(tradeDoc, {
        riskStatus: "PENDING_SCORE",
        priority: null,
        priorityRank: 0,
        riskScore: null,
        score: null
      });
      return;
    }
    const { tradeId, riskStatus, priority, ...score } = result;
    Object.assign(tradeDoc, {
      riskStatus,
      priority,
      priorityRank: PRIORITY_RANK[priority] ?? 0,
      riskScore: score.finalScore,
      score
    });
  }
};