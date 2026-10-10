import { Router } from "express";
import { queueController } from "../controllers/queueController.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";

const router = Router();

router.use(auth);

router.get("/", requirePerm("WORK_QUEUE"), queueController.listQueue);
router.post("/:queueId/assign", requirePerm("WORK_QUEUE"), queueController.assignQueue);
router.post("/:queueId/resolve", requirePerm("RESOLVE_EXCEPTIONS"), queueController.resolveQueue);

export default router;