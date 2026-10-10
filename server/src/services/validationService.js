import { tradeFormSchema, bulkRowSchema, zodToDetails, MSG } from "@tradeperfect/shared";
import { refCache } from "./refCache.js";

export function checkMasterData(t) {
  const errors = [];
  if (!refCache.hasSymbol(t.symbol)) {
    errors.push({ field: "symbol", ruleId: "R-005", message: MSG.R005(t.symbol) });
  }
  if (!refCache.hasCounterparty(t.counterparty)) {
    errors.push({ field: "counterparty", ruleId: "R-006", message: MSG.R006(t.counterparty) });
  }
  const acc = refCache.getAccount(t.accountId);
  if (!acc) {
    errors.push({ field: "accountId", ruleId: "R-007", message: MSG.R007_MISSING(t.accountId) });
  } else if (acc.status !== "ACTIVE") {
    errors.push({ field: "accountId", ruleId: "R-007", message: MSG.R007_INACTIVE(t.accountId) });
  }
  return errors;
}

export const validationService = {
  validateFormTrade(body) {
    const r = tradeFormSchema.safeParse(body);
    if (!r.success) {
      return { data: null, errors: zodToDetails(r.error) };
    }
    const masterErrors = checkMasterData(r.data);
    return { data: r.data, errors: masterErrors };
  },

  validateBulkRow(row) {
    const r = bulkRowSchema.safeParse(row);
    if (!r.success) {
      return { data: null, errors: zodToDetails(r.error) };
    }
    const masterErrors = checkMasterData(r.data);
    return { data: r.data, errors: masterErrors };
  }
};