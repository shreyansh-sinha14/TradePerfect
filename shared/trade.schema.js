import { z } from "zod";
import { MSG, FIELD_RULE } from "./constants.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const TRUE = ["true", "yes", "y", "1"];
const FALSE = ["false", "no", "n", "0"];
export const parseBool = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (TRUE.includes(s)) return true;
  if (FALSE.includes(s)) return false;
  return undefined;
};
const emptyToUndef = (v) => (v === "" || v === null ? undefined : v);
const upperTrim = (v) => (typeof v === "string" ? v.trim().toUpperCase() : emptyToUndef(v));
const toNumber = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));

const reqStr = (f, max = 50) =>
  z.preprocess(upperTrim, z.string({ required_error: MSG.REQUIRED(f) }).min(1, MSG.REQUIRED(f)).max(max, MSG.TOO_LONG(f, max)));
const dateField = (f) =>
  z.preprocess(emptyToUndef, z.string({ required_error: MSG.REQUIRED(f) })
    .regex(DATE_RE, MSG.DATE_FORMAT(f)).refine(isRealDate, MSG.DATE_INVALID(f)));
const boolField = (f) =>
  z.preprocess(parseBool, z.boolean({ required_error: MSG.BOOL(f), invalid_type_error: MSG.BOOL(f) }));

export const fieldSchemas = {
  tradeType: z.preprocess(upperTrim, z.enum(["BUY", "SELL"], { errorMap: () => ({ message: MSG.R002 }) })),
  symbol: reqStr("symbol", 20),
  quantity: z.preprocess(toNumber, z.number({ required_error: MSG.REQUIRED("quantity"), invalid_type_error: MSG.R003 }).int(MSG.R003).positive(MSG.R003)),
  price: z.preprocess(toNumber, z.number({ required_error: MSG.REQUIRED("price"), invalid_type_error: MSG.R004 }).positive(MSG.R004).finite(MSG.R004)),
  counterparty: reqStr("counterparty", 50),
  tradeDate: dateField("tradeDate"),
  settlementDate: dateField("settlementDate"),
  accountId: reqStr("accountId", 30),
  ssiMatched: boolField("ssiMatched"),
  currencyMatched: boolField("currencyMatched"),
};

export const tradeFormSchema = z.object(fieldSchemas).strict();

export const tradeUpdateSchema = z.object({
  ...fieldSchemas,
  queueId: z.string().regex(/^Q\d{6}$/).optional(),
  fixNote: z.string().trim().max(500, MSG.TOO_LONG("fixNote", 500)).optional(),
}).strict();

export const bulkRowSchema = z.object({
  tradeId: z.preprocess(upperTrim, z.string({ required_error: MSG.R001_EMPTY }).min(1, MSG.R001_EMPTY).max(30, MSG.TOO_LONG("tradeId", 30))),
  traderName: z.preprocess(emptyToUndef, z.string({ required_error: MSG.REQUIRED("traderName") }).trim().min(1).max(80)),
  ...fieldSchemas,
});

export const rejectSchema = z.object({ reason: z.string().trim().min(10, MSG.REASON_MIN).max(500) });

export function zodToDetails(zodError) {
  return zodError.issues.map((i) => {
    const field = String(i.path[0] ?? "body");
    return { field, ruleId: FIELD_RULE[field] ?? "SCHEMA", message: i.message };
  });
}

export function validateField(field, value) {
  const s = fieldSchemas[field];
  if (!s) return null;
  const r = s.safeParse(value);
  return r.success ? null : r.error.issues[0].message;
}