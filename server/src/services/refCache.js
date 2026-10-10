import Symbol from "../models/Symbol.js";
import Counterparty from "../models/Counterparty.js";
import Account from "../models/Account.js";

class RefCache {
  constructor() {
    this.symbols = new Map();
    this.counterparties = new Map();
    this.accounts = new Map();
  }

  async load() {
    try {
      const syms = await Symbol.find({ active: true }).lean();
      this.symbols.clear();
      syms.forEach(s => this.symbols.set(s.symbol, s));

      const cps = await Counterparty.find({ active: true }).lean();
      this.counterparties.clear();
      cps.forEach(c => this.counterparties.set(c.code, c));

      const accs = await Account.find({}).lean();
      this.accounts.clear();
      accs.forEach(a => this.accounts.set(a.accountId, a));

      console.log(`RefCache loaded: ${this.symbols.size} symbols, ${this.counterparties.size} counterparties, ${this.accounts.size} accounts.`);
    } catch (err) {
      console.error("Failed to load RefCache:", err.message);
    }
  }

  hasSymbol(s) { return this.symbols.has(s); }
  hasCounterparty(c) { return this.counterparties.has(c); }
  getAccount(a) { return this.accounts.get(a); }

  lists() {
    return {
      symbols: Array.from(this.symbols.values()),
      counterparties: Array.from(this.counterparties.values()),
      accounts: Array.from(this.accounts.values())
    };
  }
}

export const refCache = new RefCache();