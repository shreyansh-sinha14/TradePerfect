export const PERMS = {
  BOOK_TRADE: ['TRADER','OPS_USER','OPS_MANAGER','SYS_ADMIN'],
  BULK_UPLOAD: ['TRADER','OPS_MANAGER','SYS_ADMIN'],
  REPLAY_MODE: ['OPS_MANAGER','SYS_ADMIN'],
  VIEW_TRADES: ['TRADER','OPS_USER','OPS_MANAGER','ML_ADMIN','SYS_ADMIN'],
  VIEW_DASHBOARD: ['TRADER','OPS_USER','OPS_MANAGER','SYS_ADMIN'],
  VIEW_QUEUE: ['OPS_USER','OPS_MANAGER','SYS_ADMIN'],
  ASSIGN_QUEUE: ['OPS_MANAGER','SYS_ADMIN'],
  WORK_QUEUE: ['OPS_USER','OPS_MANAGER','SYS_ADMIN'],
  VIEW_AUDIT_PAGE: ['OPS_MANAGER','SYS_ADMIN'],
  VIEW_TRADE_AUDIT: ['OPS_MANAGER','SYS_ADMIN','OPS_USER'],
  SEND_REPORTS: ['OPS_MANAGER','SYS_ADMIN'],
  LIST_USERS: ['OPS_MANAGER','SYS_ADMIN'],
  CHAT: ['TRADER','OPS_USER','OPS_MANAGER','ML_ADMIN','SYS_ADMIN'],
  ML_VIEW: ['OPS_MANAGER','ML_ADMIN','SYS_ADMIN'],
  ML_MANAGE: ['ML_ADMIN','SYS_ADMIN']
};
export const can = (user, permission) => !!user && (PERMS[permission] || []).includes(user.role);
export const HOME_ROUTE = { TRADER:'/trades', OPS_USER:'/queue', OPS_MANAGER:'/dashboard', ML_ADMIN:'/ml', SYS_ADMIN:'/dashboard' };
export const isManager = user => !!user && ['OPS_MANAGER','SYS_ADMIN'].includes(user.role);
export const queueActions = (item,user) => ({
  canAssign: isManager(user) && ['OPEN','IN_PROGRESS'].includes(item.status),
  canApplyFix: !!user && ['OPS_USER','OPS_MANAGER','SYS_ADMIN'].includes(user.role) && item.status === 'IN_PROGRESS' && (isManager(user) || item.assigneeId === user.userId),
  canResubmit: !!user && ['OPS_USER','OPS_MANAGER','SYS_ADMIN'].includes(user.role) && item.status === 'IN_PROGRESS' && item.priority === 'LOW' && (isManager(user) || item.assigneeId === user.userId),
  canReject: isManager(user) && item.priority === 'HIGH' && ['OPEN','IN_PROGRESS'].includes(item.status)
});
export const canEditTrade = (trade,user,queueItem=null) => {
  if (!trade || !user || trade.riskStatus === 'REJECTED' || trade.queueStatus === 'REJECTED') return false;
  if (['OPS_MANAGER','SYS_ADMIN'].includes(user.role)) return true;
  if (user.role === 'TRADER') return trade.traderId === user.userId;
  if (user.role === 'OPS_USER') return !!queueItem && queueItem.assigneeId === user.userId && queueItem.status === 'IN_PROGRESS';
  return false;
};