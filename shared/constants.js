export const ROLES = ["TRADER", "OPS_USER", "OPS_MANAGER", "ML_ADMIN", "SYS_ADMIN"];
export const TRADE_TYPES = ["BUY", "SELL"];
export const RISK_STATUS = ["PASS", "MONITOR", "EXCEPTION", "REJECTED", "PENDING_SCORE"];
export const PRIORITY = ["HIGH", "MEDIUM", "LOW"];
export const PRIORITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export const QUEUE_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"];
export const RESOLUTION_TYPE = ["FIXED", "RESUBMITTED", "CANCELLED", "AUTO_LOW"];
export const SCORING_MODE = ["HYBRID", "RULES_ONLY"];
export const TRADE_SOURCE = ["FORM", "BULK", "STREAM"];
export const AS_OF_MODE = ["TODAY", "TRADE_DATE"];
export const UPLOAD_JOB_STATUS = ["PENDING", "RUNNING", "COMPLETED", "FAILED"];

export const AUDIT_EVENTS = [
  "LOGIN", "TRADE_SUBMITTED", "TRADE_UPDATED", "VALIDATION_FAILED", "TRADE_REJECTED", "TRADE_SCORED",
  "QUEUE_CREATED", "QUEUE_ASSIGNED", "QUEUE_REASSIGNED", "FIX_APPLIED", "TRADE_RESUBMITTED",
  "QUEUE_RESOLVED", "QUEUE_REJECTED", "QUEUE_REOPENED",
  "BULK_UPLOAD_STARTED", "BULK_UPLOAD_COMPLETED", "REPORT_GENERATED", "REPORT_EMAILED", "CHAT_QUERY",
  "MODEL_TRAINED", "MODEL_PROMOTED", "MODEL_ROLLED_BACK", "DRIFT_CHECK_RUN", "DRIFT_ALERT", "CONFIG_CHANGED",
];

export const HARD_GATES = {
  "R-001": "tradeId empty or duplicate",
  "R-002": "tradeType not BUY or SELL",
  "R-003": "quantity not a positive integer",
  "R-004": "price not a positive decimal",
  "R-005": "symbol not in Symbol master",
  "R-006": "counterparty not in Counterparty master",
  "R-007": "accountId does not exist or is inactive",
};

export const FIELD_RULE = {
  tradeId: "R-001", tradeType: "R-002", quantity: "R-003", price: "R-004",
  symbol: "R-005", counterparty: "R-006", accountId: "R-007",
};

export const FIELD_LABELS = {
  tradeId: "Trade ID", tradeType: "Trade type", symbol: "Symbol", quantity: "Quantity", price: "Price",
  counterparty: "Counterparty", tradeDate: "Trade date", settlementDate: "Settlement date",
  accountId: "Account", traderName: "Trader name", ssiMatched: "SSI matched", currencyMatched: "Currency matched",
  fixNote: "Fix note", reason: "Reason",
};

export const MSG = {
  REQUIRED: (f) => `${FIELD_LABELS[f] ?? f} is required.`,
  DATE_FORMAT: (f) => `${FIELD_LABELS[f] ?? f} must be in YYYY-MM-DD format.`,
  DATE_INVALID: (f) => `${FIELD_LABELS[f] ?? f} is not a real calendar date.`,
  BOOL: (f) => `${FIELD_LABELS[f] ?? f} must be Yes or No.`,
  TOO_LONG: (f, n) => `${FIELD_LABELS[f] ?? f} must be at most ${n} characters.`,
  R001_EMPTY: "Trade ID is required.",
  R001_DUP: (id) => `Trade ID ${id} already exists. Use a new Trade ID.`,
  R002: "Trade type must be BUY or SELL.",
  R003: "Quantity must be a whole number greater than 0.",
  R004: "Price must be a number greater than 0.",
  R005: (s) => `Symbol ${s} is not in the Symbol master. Pick a listed symbol.`,
  R006: (c) => `Counterparty ${c} is not in the Counterparty master. Pick a listed counterparty.`,
  R007_MISSING: (a) => `Account ${a} does not exist. Choose a valid account.`,
  R007_INACTIVE: (a) => `Account ${a} is inactive. Choose an active account.`,
  REASON_MIN: "Reason must be at least 10 characters.",
  Q_RESUBMIT_HIGH: "Re-submit is not allowed for HIGH priority (EXCEPTION) trades.",
  Q_BULK_RESUBMIT_LOW: "Bulk Re-submit is allowed only when every selected item is LOW priority.",
  Q_REJECT_NOT_HIGH: "Only HIGH priority (EXCEPTION) items can be rejected.",
  Q_NOT_ACTIVE: "This queue item is already RESOLVED or REJECTED.",
  Q_NOT_ASSIGNED_TO_YOU: "This queue item is not assigned to you.",
  Q_ASSIGNEE_INVALID: "Assignee must be an active Operations User.",
  T_REJECTED_READONLY: "Rejected trades must be fixed in the source system.",
  T_CANCELLED: "This trade was rejected in the repair queue and can no longer be changed.",
};

export const STATUS_COLOR = { PASS: "green", MONITOR: "orange", EXCEPTION: "red", REJECTED: "default", PENDING_SCORE: "default" };
export const PRIORITY_COLOR = { HIGH: "red", MEDIUM: "orange", LOW: "blue" };
export const QUEUE_STATUS_COLOR = { OPEN: "blue", IN_PROGRESS: "gold", RESOLVED: "green", REJECTED: "volcano" };

export const ML_TARGETS = {
  auc: { op: ">=", value: 0.90 }, recall: { op: ">=", value: 0.85 }, precision: { op: ">=", value: 0.70 },
  f1: { op: ">=", value: 0.77 }, accuracy: { op: ">", value: 0.90 }, fpr: { op: "<", value: 0.05 },
};

export const UPLOAD_LIMITS = { maxRows: 10000, maxBytes: 5 * 1024 * 1024 };
export const CSV_HEADER = ["tradeId","tradeType","symbol","quantity","price","counterparty",
  "tradeDate","settlementDate","accountId","traderName","ssiMatched","currencyMatched"];