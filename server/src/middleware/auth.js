import jwt from "jsonwebtoken";
import { unauthorized } from "../utils/AppError.js";

export function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(unauthorized("Missing or invalid token."));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.sub,
      name: decoded.name,
      role: decoded.role
    };
    next();
  } catch (err) {
    next(unauthorized("Token expired or invalid."));
  }
}