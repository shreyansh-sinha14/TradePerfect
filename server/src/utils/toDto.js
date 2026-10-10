export const toUserDTO = (u) => ({
  userId: u.userId,
  username: u.username,
  name: u.name,
  role: u.role
});

export const toTradeDTO = (t) => ({
  tradeId: t.tradeId,
  version: t.version,
  tradeType: t.tradeType,
  symbol: t.symbol,
  quantity: t.quantity,
  price: t.price,
  counterparty: t.counterparty,
  tradeDate: t.tradeDate,
  settlementDate: t.settlementDate,
  accountId: t.accountId,
  traderName: t.traderName,
  traderUserId: t.traderUserId,
  ssiMatched: t.ssiMatched,
  currencyMatched: t.currencyMatched,
  source: t.source,
  riskStatus: t.riskStatus,
  priority: t.priority,
  riskScore: t.riskScore,
  score: t.score,
  queueId: t.queueId,
  queueStatus: t.queueStatus,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt
});

export const toTradeRowDTO = (t) => ({
  tradeId: t.tradeId,
  tradeType: t.tradeType,
  symbol: t.symbol,
  quantity: t.quantity,
  price: t.price,
  counterparty: t.counterparty,
  tradeDate: t.tradeDate,
  settlementDate: t.settlementDate,
  traderName: t.traderName,
  riskStatus: t.riskStatus,
  priority: t.priority,
  riskScore: t.riskScore,
  queueId: t.queueId,
  queueStatus: t.queueStatus,
  rejectionReasons: t.rejectionReasons,
  // Grid columns FR-RQ-008 (no SHAP/raw model data - keeps the grid light)
  score: t.score ? {
    finalScore: t.score.finalScore,
    likelyReason: t.score.likelyReason,
    suggestedAction: t.score.suggestedAction,
    riskFactors: t.score.riskFactors,
    explanation: t.score.explanation,
    scoringMode: t.score.scoringMode
  } : null
});