import { Router } from "express";
import { tradeController } from "../controllers/tradeController.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";

const router = Router();

router.use(auth);

router.post("/validate", requirePerm("BOOK_TRADE", "WORK_QUEUE"), tradeController.validateTrade);
router.post("/", requirePerm("BOOK_TRADE"), tradeController.createTrade);
router.get("/", requirePerm("VIEW_DASHBOARD"), tradeController.listTrades);
router.get("/export.csv", requirePerm("VIEW_DASHBOARD"), tradeController.exportTrades);
router.get("/:tradeId", requirePerm("VIEW_TRADES"), tradeController.getTrade);
router.put("/:tradeId", requirePerm("BOOK_TRADE", "WORK_QUEUE"), tradeController.updateTrade);
router.get("/:tradeId/history", requirePerm("VIEW_TRADES"), tradeController.getHistory);

export default router;