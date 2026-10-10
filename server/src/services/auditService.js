import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import stringify from "fast-json-stable-stringify";
import AuditEvent from "../models/AuditEvent.js";

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const body = (e) => stringify({
  eventId: e.eventId,
  chainKey: e.chainKey,
  seq: e.seq,
  ts: e.ts,
  eventType: e.eventType,
  actor: e.actor,
  tradeId: e.tradeId ?? null,
  queueId: e.queueId ?? null,
  details: e.details ?? {}
});

function pickActor(actor) {
  if (!actor) return { userId: "system", name: "System", role: "SYSTEM" };
  return {
    userId: actor.userId ?? "system",
    name: actor.name ?? "System",
    role: actor.role ?? "SYSTEM"
  };
}

export const auditService = {
  async log({ eventType, actor, tradeId = null, queueId = null, tradeDate = null, settlementDate = null, details = {} }) {
    const chainKey = tradeId ?? "SYSTEM";
    
    // Retry loop for atomic sequence incrementing in case of concurrent writes
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await AuditEvent.findOne({ chainKey }, { seq: 1, hash: 1 }).sort({ seq: -1 }).lean();
      const seq = (last?.seq ?? 0) + 1;
      const prevHash = last?.hash ?? "GENESIS";
      
      const e = {
        eventId: uuidv4(),
        chainKey,
        seq,
        ts: new Date().toISOString(),
        eventType,
        actor: pickActor(actor),
        tradeId,
        queueId,
        tradeDate,
        settlementDate,
        details,
        prevHash
      };
      
      e.hash = sha(prevHash + body(e));

      try {
        await AuditEvent.create(e);
        return e;
      } catch (err) {
        if (err.code !== 11000) throw err; // Retry on duplicate key race condition
      }
    }
    throw new Error("Failed to write audit event after retries.");
  },

  async verify(tradeId) {
    const evs = await AuditEvent.find({ chainKey: tradeId }).sort({ seq: 1 }).lean();
    let prev = "GENESIS";
    for (const e of evs) {
      if (e.prevHash !== prev || e.hash !== sha(prev + body(e))) {
        return { tradeId, valid: false, checked: evs.length, brokenAt: { seq: e.seq, eventId: e.eventId } };
      }
      prev = e.hash;
    }
    return { tradeId, valid: true, checked: evs.length, brokenAt: null };
  }
};