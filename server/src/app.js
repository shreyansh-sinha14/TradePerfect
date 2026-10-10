import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { pinoHttp } from "pino-http";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./utils/AppError.js";
import authRoutes from "./routes/auth.routes.js";
import refRoutes from "./routes/ref.routes.js";
import tradeRoutes from "./routes/trades.routes.js";
import queueRoutes from "./routes/queue.routes.js";

const app = express();

// 1. Request ID Injection
app.use(requestId);

// 2. Logging (Keeping it silent in console for cleaner development)
app.use(pinoHttp({ autoLogging: false, quietReqLogger: true }));

// 3. Security Headers
app.use(helmet());

// 4. CORS exactly as specified in N-00
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  exposedHeaders: ["X-Request-Id", "Content-Disposition", "X-Emailed"]
}));

// 5. Body Parsing with 1MB limit
app.use(express.json({ limit: "1mb" }));

// 6. NoSQL Injection Protection
app.use(mongoSanitize());

// 7. Temporary Health Route (Will be moved to N-14 later)
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ status: "ok", db: "up", riskService: "pending", modelVersion: "v1" });
});

// 8. Mount Auth Routes (Module N-01)
app.use("/api/v1/auth", authRoutes);

// 9. Mount Reference Data Routes (Module N-02)
app.use("/api/v1/ref", refRoutes);

// 10. Mount Trade Routes (Module N-05)
app.use("/api/v1/trades", tradeRoutes);

// 11. Mount Queue Routes (Module N-07/N-08)
app.use("/api/v1/queue", queueRoutes);

// 12. 404 Handler
app.use((req, res, next) => next(notFound(`Route ${req.originalUrl} not found`)));

// 13. Centralized Error Handler
app.use(errorHandler);

export default app;