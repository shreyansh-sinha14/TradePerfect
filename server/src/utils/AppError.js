export class AppError extends Error {
  constructor(status, code, message, details = []) { 
    super(message); 
    this.status = status; 
    this.code = code; 
    this.details = details; 
  }
}
export const badRequest = (m, d) => new AppError(400, "BAD_REQUEST", m, d);
export const fileInvalid = (m, d) => new AppError(400, "FILE_INVALID", m, d);
export const unauthorized = (m = "Please log in.") => new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "You do not have access to this.") => new AppError(403, "FORBIDDEN", m);
export const notFound = (m) => new AppError(404, "NOT_FOUND", m);
export const businessRule = (m, d) => new AppError(409, "BUSINESS_RULE", m, d);
export const validationFailed = (details) =>
  new AppError(422, "VALIDATION_FAILED", `${details.length} field${details.length > 1 ? "s" : ""} need attention`, details);