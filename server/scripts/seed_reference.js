import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";
import Symbol from "../src/models/Symbol.js";
import Counterparty from "../src/models/Counterparty.js";
import Account from "../src/models/Account.js";
import Counter from "../src/models/Counter.js";

const MONGO_URI = process.env.MONGO_URI;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@123";

async function seedDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // 1. Seed Counter for Trade IDs (Start at 100000 so first trade is T100001)
    await Counter.findOneAndUpdate(
      { _id: "trade" },
      { $setOnInsert: { seq: 100000 } },
      { upsert: true }
    );
    await Counter.findOneAndUpdate(
      { _id: "queue" },
      { $setOnInsert: { seq: 0 } },
      { upsert: true }
    );
    await Counter.findOneAndUpdate(
      { _id: "job" },
      { $setOnInsert: { seq: 0 } },
      { upsert: true }
    );
    console.log("Counters initialized.");

    // 2. Seed Master Reference Data
    await Symbol.deleteMany({});
    await Symbol.insertMany([
      { symbol: "INFY", name: "Infosys Ltd", active: true },
      { symbol: "RELIANCE", name: "Reliance Industries", active: true },
      { symbol: "TCS", name: "Tata Consultancy Services", active: true },
      { symbol: "HDFC", name: "HDFC Bank Ltd", active: true }
    ]);
    console.log("Symbols seeded.");

    await Counterparty.deleteMany({});
    // Counterparties from the historical training data (same names the risk-service
    // model uses for the counterparty tier rule, Decision Logic 3.2.5).
    // Without these, the tier rule can never fire for a booked trade.
    const HISTORICAL_COUNTERPARTIES = [
      "BANK OF AMERICA", "BARCLAYS", "BARCLAYS WEALTH", "BLACKROCK", "BOFA SECURITIES",
      "CAPITAL GROUP", "CENTERVIEW", "CHARLES SCHWAB", "CITIGROUP", "COMMERZBANK",
      "CREDIT SUISSE", "DEUTSCHE BANK", "E*TRADE", "EVERCORE", "FIDELITY", "GOLDMAN SACHS",
      "GOLDMAN SACHS ASSET MANAGEMENT", "HSBC", "ING GROUP", "INTERACTIVE BROKERS", "JEFFERIES",
      "JPMORGAN CHASE", "LAZARD", "MIZUHO", "MOELIS", "MORGAN STANLEY", "NOMURA", "NORTHERN TRUST",
      "PJT PARTNERS", "RAYMOND JAMES", "ROYAL BANK OF SCOTLAND", "SANTANDER", "SOCIETE GENERALE",
      "STANDARD CHARTERED", "STATE STREET", "TOKYO MARINE", "UBS", "VANGUARD"
    ];
    await Counterparty.insertMany([
      { code: "ABC_BANK", name: "ABC Bank", active: true },
      { code: "XYZ_CAPITAL", name: "XYZ Capital Corp", active: true },
      { code: "BNP_PARIBAS", name: "BNP Paribas SA", active: true },
      ...HISTORICAL_COUNTERPARTIES.map((code) => ({ code, name: code, active: true }))
    ]);
    console.log("Counterparties seeded.");

    await Account.deleteMany({});
    await Account.insertMany([
      { accountId: "ACC7788", name: "Prop Desk 1", status: "ACTIVE" },
      { accountId: "ACC1001", name: "Retail Flow Desk", status: "ACTIVE" },
      { accountId: "ACC9999", name: "Legacy Closed Desk", status: "INACTIVE" }
    ]);
    console.log("Accounts seeded.");

    // 3. Seed Users for All Roles
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await User.deleteMany({});
    await User.insertMany([
      { userId: "u1", username: "trader1", name: "Ravi Kumar", email: "trader@bank.com", role: "TRADER", passwordHash, active: true },
      { userId: "u2", username: "ops1", name: "Asha Patil", email: "ops1@bank.com", role: "OPS_USER", passwordHash, active: true },
      { userId: "u3", username: "manager1", name: "Vikram Malhotra", email: "manager@bank.com", role: "OPS_MANAGER", passwordHash, active: true },
      { userId: "u4", username: "mladmin1", name: "Dr. Alan Turing", email: "mladmin@bank.com", role: "ML_ADMIN", passwordHash, active: true },
      { userId: "u5", username: "admin1", name: "System Admin", email: "sysadmin@bank.com", role: "SYS_ADMIN", passwordHash, active: true }
    ]);
    console.log(`Users seeded successfully. Default password for all users is: ${DEMO_PASSWORD}`);

    console.log("Database seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seedDatabase();