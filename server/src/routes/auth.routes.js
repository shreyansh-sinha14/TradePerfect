import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } }
});

router.post("/login", loginLimiter, authController.login);
router.get("/me", auth, authController.me);

export default router;