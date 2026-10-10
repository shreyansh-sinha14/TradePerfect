import { Router } from "express";
import { auditController } from "../controllers/auditController.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";

// Read-only by design: no update/delete routes for audit events (FR-AT-005)
const router = Router();

router.use(auth);

router.get("/", requirePerm("VIEW_AUDIT_PAGE"), auditController.search);
router.get("/export.csv", requirePerm("VIEW_AUDIT_PAGE"), auditController.exportCsv);
router.get("/verify", requirePerm("VIEW_AUDIT_PAGE"), auditController.verify);
router.get("/trades/:tradeId/timeline", requirePerm("VIEW_TRADE_AUDIT"), auditController.timeline);
router.get("/trades/:tradeId/latest", requirePerm("VIEW_TRADE_AUDIT"), auditController.latest);

export default router;
