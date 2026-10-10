import { stringify } from "csv-stringify/sync";

// CSV injection guard (plan 9.9): prefix ' to text cells starting with = + - @
const safeCell = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" && /^[=+\-@]/.test(v)) return `'${v}`;
  return v;
};

export function toCsv(header, rows) {
  return stringify([header, ...rows.map((r) => r.map(safeCell))]);
}

export function sendCsv(res, fileName, header, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(200).send(toCsv(header, rows));
}
