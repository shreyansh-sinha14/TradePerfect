import { z } from 'zod';
import { CSV_HEADER, MSG } from './constants.js';
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const realDate = s => {
  if (!dateRegex.test(s || '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s;
};
const dateField = field => z.string().min(1, MSG.REQUIRED(field)).regex(dateRegex, MSG.DATE_FORMAT(field)).refine(realDate, MSG.DATE_INVALID(field));
export const tradeFormSchema = z.object({
  tradeType: z.enum(['BUY','SELL'], { errorMap: () => ({ message: MSG.R002 }) }),
  symbol: z.string().trim().min(1, MSG.REQUIRED('symbol')).max(20, MSG.TOO_LONG('symbol',20)).transform(v=>v.toUpperCase()),
  quantity: z.coerce.number().int().positive(MSG.R003),
  price: z.coerce.number().positive(MSG.R004),
  counterparty: z.string().trim().min(1, MSG.REQUIRED('counterparty')).max(50, MSG.TOO_LONG('counterparty',50)).transform(v=>v.toUpperCase()),
  tradeDate: dateField('tradeDate'),
  settlementDate: dateField('settlementDate'),
  accountId: z.string().trim().min(1, MSG.REQUIRED('accountId')).max(30, MSG.TOO_LONG('accountId',30)).transform(v=>v.toUpperCase()),
  ssiMatched: z.boolean(),
  currencyMatched: z.boolean()
});
export const tradeUpdateSchema = tradeFormSchema.extend({
  queueId: z.string().regex(/^Q\d{6}$/).optional(),
  fixNote: z.string().max(500, MSG.TOO_LONG('fixNote',500)).optional()
});
export const rejectSchema = z.object({ reason: z.string().trim().min(10, MSG.REASON_MIN).max(500) });
export const csvHeader = CSV_HEADER;
export function validateField(field,value) {
  const sample = {
    tradeType:'BUY',symbol:'INFY',quantity:1,price:1,counterparty:'ABC_BANK',
    tradeDate:'2026-10-10',settlementDate:'2026-10-13',accountId:'ACC7788',
    ssiMatched:true,currencyMatched:true
  };
  sample[field] = value;
  const parsed = tradeFormSchema.safeParse(sample);
  if (parsed.success) return null;
  const issue = parsed.error.issues.find(i => i.path[0] === field);
  return issue?.message || null;
}
export function toZodDetails(error) {
  return (error?.issues || []).map(issue => ({ field: String(issue.path?.[0] || 'body'), ruleId: 'SCHEMA', message: issue.message }));
}
