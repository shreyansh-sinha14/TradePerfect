import Counter from "../models/Counter.js";

export async function nextId(counterName, prefix = "", padLength = 6) {
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const paddedNum = String(counter.seq).padStart(padLength, "0");
  return prefix ? `${prefix}${paddedNum}` : paddedNum;
}