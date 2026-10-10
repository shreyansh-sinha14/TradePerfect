import { v4 as uuidv4 } from "uuid";

export function requestId(req, res, next) {
  req.id = req.get("X-Request-Id") || uuidv4();
  res.setHeader("X-Request-Id", req.id);
  next();
}