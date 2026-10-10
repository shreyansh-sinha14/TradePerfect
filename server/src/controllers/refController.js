import { refCache } from "../services/refCache.js";

export const refController = {
  listSymbols(req, res) {
    const symbols = Array.from(refCache.symbols.values()).map(s => ({
      symbol: s.symbol,
      name: s.name
    }));
    res.status(200).json({ items: symbols });
  },

  listCounterparties(req, res) {
    const cps = Array.from(refCache.counterparties.values()).map(c => ({
      code: c.code,
      name: c.name
    }));
    res.status(200).json({ items: cps });
  },

  listAccounts(req, res) {
    const activeOnly = req.query.active !== "false";
    let accounts = Array.from(refCache.accounts.values());
    if (activeOnly) {
      accounts = accounts.filter(a => a.status === "ACTIVE");
    }
    res.status(200).json({
      items: accounts.map(a => ({
        accountId: a.accountId,
        name: a.name,
        status: a.status
      }))
    });
  }
};