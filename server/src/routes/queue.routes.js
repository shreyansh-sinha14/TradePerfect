import { Router } from "express";
import { queueController } from "../controllers/queueController.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";

const router = Router();

router.use(auth);

// Static paths first so they are not read as a :queueId
router.get("/", requirePerm("WORK_QUEUE"), queueController.listQueue);
router.get("/stats", requirePerm("WORK_QUEUE"), queueController.stats);
router.get("/export.csv", requirePerm("WORK_QUEUE"), queueController.exportQueue);
router.post("/assign", requirePerm("ASSIGN_QUEUE"), queueController.bulkAssign);
router.post("/resubmit", requirePerm("WORK_QUEUE"), queueController.resubmit);

router.get("/:queueId", requirePerm("WORK_QUEUE"), queueController.getQueueItem);
router.post("/:queueId/assign", requirePerm("WORK_QUEUE"), queueController.assignQueue);
router.post("/:queueId/resolve", requirePerm("RESOLVE_EXCEPTIONS"), queueController.resolveQueue);
router.post("/:queueId/resubmit", requirePerm("WORK_QUEUE"), queueController.resubmit);
router.post("/:queueId/reject", requirePerm("WORK_QUEUE"), queueController.reject);

export default router;
