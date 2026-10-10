export const ROLES = ['TRADER', 'OPS_USER', 'OPS_MANAGER', 'ML_ADMIN', 'SYS_ADMIN'];
export const TRADE_TYPES = ['BUY', 'SELL'];
export const RISK_STATUS = ['PASS', 'MONITOR', 'EXCEPTION', 'REJECTED', 'PENDING_SCORE'];
export const PRIORITY = ['HIGH', 'MEDIUM', 'LOW'];
export const QUEUE_STATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
export const EVENT_TYPES = ['LOGIN','TRADE_SUBMITTED','TRADE_UPDATED','VALIDATION_FAILED','TRADE_REJECTED','TRADE_SCORED','QUEUE_CREATED','QUEUE_ASSIGNED','QUEUE_RESUBMITTED','FIX_APPLIED','QUEUE_RESOLVED','QUEUE_REJECTED','BULK_UPLOAD_STARTED','BULK_UPLOAD_COMPLETED','BULK_UPLOAD_FAILED','REPORT_GENERATED','REPORT_EMAILED','CHAT_QUERY','MODEL_TRAINED','MODEL_PROMOTED','MODEL_ROLLED_BACK','DRIFT_CHECK_RUN','DRIFT_ALERT','CONFIG_CHANGED'];
export const STATUS_COLORS = { PASS: 'green', MONITOR: 'orange', EXCEPTION: 'red', REJECTED: 'default', PENDING_SCORE: 'default' };
export const PRIORITY_COLORS = { HIGH: 'red', MEDIUM: 'orange', LOW: 'blue' };
export const QUEUE_STATUS_COLORS = { OPEN: 'blue', IN_PROGRESS: 'gold', RESOLVED: 'green', REJECTED: 'volcano' };
export const ML_TARGETS = {
  auc: { value: 0.93, op: '>=', target: 0.85 },
  recall: { value: 0.87, op: '>=', target: 0.70 },
  f1: { value: 0.82, op: '>=', target: 0.77 },
  accuracy: { value: 0.94, op: '>=', target: 0.90 },
  fpr: { value: 0.03, op: '<=', target: 0.05 }
};
export const CSV_HEADER = ['tradeId','tradeType','symbol','quantity','price','counterparty','tradeDate','settlementDate','accountId','traderName','ssiMatched','currencyMatched'];
export const FIELD_LABELS = {
  tradeId:'Trade ID', tradeType:'Trade type', symbol:'Symbol', quantity:'Quantity', price:'Price',
  counterparty:'Counterparty', tradeDate:'Trade date', settlementDate:'Settlement date',
  accountId:'Account', traderName:'Trader name', ssiMatched:'SSI matched',
  currencyMatched:'Currency matched', fixNote:'Fix note', reason:'Reason'
};
export const MSG = {
  REQUIRED: f => `${FIELD_LABELS[f] || f} is required.`,
  DATE_FORMAT: f => `${FIELD_LABELS[f] || f} must use YYYY-MM-DD format.`,
  DATE_INVALID: f => `${FIELD_LABELS[f] || f} is not a real calendar date.`,
  BOOL: f => `${FIELD_LABELS[f] || f} must be true or false.`,
  TOO_LONG: (f,n) => `${FIELD_LABELS[f] || f} must be at most ${n} characters.`,
  R001_EMPTY: 'Trade ID is required.',
  R001_DUP: id => `Trade ID ${id} already exists. Use a new Trade ID.`,
  R002: 'Trade type must be BUY or SELL.',
  R003: 'Quantity must be a whole number greater than zero.',
  R004: 'Price must be a number greater than zero.',
  R005: s => `Symbol ${s} is not in the Symbol master. Pick a listed symbol.`,
  R006: c => `Counterparty ${c} is not in the Counterparty master. Pick a listed counterparty.`,
  R007_MISSING: a => `Account ${a} does not exist. Choose an active account.`,
  R007_INACTIVE: a => `Account ${a} is inactive. Choose an active account.`,
  REASON_MIN: 'Reason must be at least 10 characters.',
  Q_RESUBMIT_HIGH: 'Bulk re-submit is not allowed for HIGH priority items.',
  Q_BULK_RESUBMIT_LOW: 'Bulk re-submit allowed only for every selected item in LOW priority.',
  Q_REJECT_NOT_HIGH: 'Only HIGH priority items can be rejected.',
  Q_NOT_ACTIVE: 'This queue item is already RESOLVED or REJECTED.',
  Q_NOT_ASSIGNED_TO_YOU: 'This queue item is not assigned to you.',
  Q_ASSIGNEE_INVALID: 'Assignee must be an active Operations User.',
  T_REJECTED_READONLY: 'Rejected trades must be fixed in the source system.',
  T_CANCELLED: 'This trade was rejected in the repair queue and can no longer be changed.'
};
