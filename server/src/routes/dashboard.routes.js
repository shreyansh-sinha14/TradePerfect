import { Router } from "express";
import { dashboardController } from "../controllers/dashboardController.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";

const router = Router();

router.use(auth);

router.get("/summary", requirePerm("VIEW_DASHBOARD"), dashboardController.summary);
router.get("/patterns", requirePerm("VIEW_DASHBOARD"), dashboardController.patterns);

export default router;
