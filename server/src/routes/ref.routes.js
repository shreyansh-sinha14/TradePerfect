import { Router } from "express";
import { refController } from "../controllers/refController.js";
import { auth } from "../middleware/auth.js";

const router = Router();

// All reference endpoints require authentication
router.use(auth);

router.get("/symbols", refController.listSymbols);
router.get("/counterparties", refController.listCounterparties);
router.get("/accounts", refController.listAccounts);

export default router;