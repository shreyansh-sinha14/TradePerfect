export const PERMS = {
  BOOK_TRADE:      ["TRADER", "OPS_MANAGER", "SYS_ADMIN"],
  BULK_UPLOAD:     ["TRADER", "OPS_MANAGER", "SYS_ADMIN"],
  REPLAY_MODE:     ["OPS_MANAGER", "SYS_ADMIN"],
  VIEW_TRADES:     ["TRADER", "OPS_USER", "OPS_MANAGER", "SYS_ADMIN"],   
  VIEW_DASHBOARD:  ["TRADER", "OPS_USER", "OPS_MANAGER", "SYS_ADMIN"],   
  VIEW_QUEUE:      ["OPS_USER", "OPS_MANAGER", "SYS_ADMIN"],             
  ASSIGN_QUEUE:    ["OPS_MANAGER", "SYS_ADMIN"],
  WORK_QUEUE:      ["OPS_USER", "OPS_MANAGER", "SYS_ADMIN"],             
  VIEW_AUDIT_PAGE: ["OPS_MANAGER", "SYS_ADMIN"],                         
  VIEW_TRADE_AUDIT:["OPS_USER", "OPS_MANAGER", "SYS_ADMIN"],             
  SEND_REPORTS:    ["OPS_MANAGER", "SYS_ADMIN"],
  LIST_USERS:      ["OPS_MANAGER", "SYS_ADMIN"],
  CHAT:            ["TRADER", "OPS_USER", "OPS_MANAGER", "ML_ADMIN", "SYS_ADMIN"],
  ML_VIEW:         ["OPS_MANAGER", "ML_ADMIN", "SYS_ADMIN"],
  ML_MANAGE:       ["ML_ADMIN", "SYS_ADMIN"],
};

export const can = (user, perm) => !!user && PERMS[perm].includes(user.role);

export const HOME_ROUTE = {
  TRADER: "/trades/new", OPS_USER: "/queue", OPS_MANAGER: "/dashboard", ML_ADMIN: "/ml", SYS_ADMIN: "/dashboard",
};

const isManager = (u) => u.role === "OPS_MANAGER" || u.role === "SYS_ADMIN";

export function queueActions(item, user) {
  const active = item.status === "OPEN" || item.status === "IN_PROGRESS";
  const owner = user.role === "OPS_USER" && item.assigneeId === user.userId;
  const canWork = active && (isManager(user) || owner);
  return {
    canAssign: active && isManager(user),
    canApplyFix: canWork,
    canResubmit: canWork && (item.priority === "MEDIUM" || item.priority === "LOW"),
    canReject: canWork && item.priority === "HIGH",
  };
}

export const canBulkAssign = (items, user) => items.length > 0 && items.every((i) => queueActions(i, user).canAssign);
export const canBulkResubmit = (items, user) =>
  items.length > 0 && items.every((i) => i.priority === "LOW" && queueActions(i, user).canResubmit);

export function canEditTrade(trade, user, queueItem = null) {
  if (trade.riskStatus === "REJECTED") return false;               
  if (trade.queueStatus === "REJECTED") return false;              
  if (isManager(user)) return true;
  if (user.role === "TRADER") return trade.traderUserId === user.userId;
  if (user.role === "OPS_USER") return !!queueItem && queueActions(queueItem, user).canApplyFix;
  return false;
}