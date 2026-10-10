import { can } from "@tradeperfect/shared";
import { forbidden } from "../utils/AppError.js";

export const requirePerm = (...perms) => (req, _res, next) => {
  const hasAccess = perms.some((p) => can(req.user, p));
  if (hasAccess) {
    return next();
  }
  return next(forbidden());
};