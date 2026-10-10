import Trade from "../models/Trade.js";
import { RISK_STATUS } from "@tradeperfect/shared";

const emptyCounts = () => Object.fromEntries(RISK_STATUS.map((s) => [s, 0]));
const scopeFor = (user) => (user.role === "TRADER" ? { traderUserId: user.userId } : {});

function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function countByStatus(match) {
  const rows = await Trade.aggregate([{ $match: match }, { $group: { _id: "$riskStatus", n: { $sum: 1 } } }]);
  const counts = emptyCounts();
  let total = 0;
  for (const r of rows) {
    counts[r._id] = (counts[r._id] || 0) + r.n;
    total += r.n;
  }
  const pct = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total ? v / total : 0]));
  return { total, counts, pct };
}

export const dashboardController = {
  // GET /dashboard/summary - today (booked today) + historical (all) counts (D/FR-RQ-002/003)
  async summary(req, res, next) {
    try {
      const scope = scopeFor(req.user);
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const [today, historical] = await Promise.all([
        countByStatus({ ...scope, createdAt: { $gte: midnight } }),
        countByStatus(scope)
      ]);
      res.status(200).json({ today: { date: localDateStr(), ...today }, historical });
    } catch (err) {
      next(err);
    }
  },

  // GET /dashboard/patterns - chart data from real trades
  async patterns(req, res, next) {
    try {
      const scope = scopeFor(req.user);
      const [byStatusRows, cpRows, dayRows] = await Promise.all([
        Trade.aggregate([{ $match: scope }, { $group: { _id: "$riskStatus", n: { $sum: 1 } } }]),
        Trade.aggregate([{ $match: scope },
          { $group: { _id: { cp: "$counterparty", st: "$riskStatus" }, n: { $sum: 1 } } }]),
        Trade.aggregate([{ $match: scope },
          { $group: { _id: { d: "$tradeDate", st: "$riskStatus" }, n: { $sum: 1 } } }])
      ]);

      const byStatus = emptyCounts();
      byStatusRows.forEach((r) => { byStatus[r._id] = r.n; });

      const cps = new Map();
      cpRows.forEach((r) => {
        const row = cps.get(r._id.cp) || { counterparty: r._id.cp, ...emptyCounts(), total: 0 };
        row[r._id.st] = r.n;
        row.total += r.n;
        cps.set(r._id.cp, row);
      });
      // Top 8 counterparties by EXCEPTION, then MONITOR, then volume
      const byCounterparty = [...cps.values()]
        .sort((a, b) => b.EXCEPTION - a.EXCEPTION || b.MONITOR - a.MONITOR || b.total - a.total)
        .slice(0, 8);

      const days = new Map();
      dayRows.forEach((r) => {
        const row = days.get(r._id.d) || { date: r._id.d, ...emptyCounts() };
        row[r._id.st] = r.n;
        days.set(r._id.d, row);
      });
      const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

      res.status(200).json({ byStatus, byCounterparty, daily });
    } catch (err) {
      next(err);
    }
  }
};
