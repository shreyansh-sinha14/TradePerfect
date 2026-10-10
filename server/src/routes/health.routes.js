import { Router } from "express";
import axios from "axios";
import mongoose from "mongoose";

const router = Router();

// GET /api/v1/health - real status of api, db and risk service (plan 7.1)
router.get("/", async (req, res) => {
  const db = mongoose.connection.readyState === 1 ? "up" : "down";
  let riskService = "down";
  let modelLoaded = null;
  let modelVersion = null;
  try {
    const r = await axios.get(`${process.env.RISK_URL || "http://localhost:8000"}/internal/v1/health`, { timeout: 2000 });
    riskService = r.data?.status === "ok" ? "up" : "down";
    modelLoaded = r.data?.modelLoaded ?? null;
    modelVersion = r.data?.modelVersion ?? null;
  } catch {
    riskService = "down";
  }
  res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db, riskService, modelLoaded, modelVersion });
});

export default router;
