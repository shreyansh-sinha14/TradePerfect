import { Router } from "express";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { requirePerm } from "../middleware/requirePerm.js";
import { toUserDTO } from "../utils/toDto.js";

const router = Router();

router.use(auth);

// GET /users?role=OPS_USER - assignee list for the repair queue, user list for audit search
router.get("/", requirePerm("LIST_USERS"), async (req, res, next) => {
  try {
    const filter = { active: true };
    if (req.query.role) filter.role = { $in: String(req.query.role).split(",") };
    const users = await User.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({ items: users.map((u) => ({ ...toUserDTO(u), status: "ACTIVE" })) });
  } catch (err) {
    next(err);
  }
});

export default router;
