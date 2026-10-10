import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { refCache } from "./services/refCache.js";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB successfully connected to TradePerfect.");
    
    // Load reference data into in-memory cache (Module N-02)
    await refCache.load();
    setInterval(() => refCache.load(), 5 * 60 * 1000); // Refresh every 5 mins

    app.listen(PORT, () => {
      console.log(`TradePerfect API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });