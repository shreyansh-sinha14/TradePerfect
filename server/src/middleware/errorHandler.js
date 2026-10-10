import { AppError } from "../utils/AppError.js";

export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  if (!isApp) console.error("Unhandled Error:", err);
  
  const status = isApp ? err.status : 500;
  res.status(status).json({
    error: { 
      code: isApp ? err.code : "INTERNAL", 
      message: isApp ? err.message : "Something went wrong.", 
      details: isApp ? err.details : [] 
    },
    requestId: req.id || "REQ-UNKNOWN",
  });
}