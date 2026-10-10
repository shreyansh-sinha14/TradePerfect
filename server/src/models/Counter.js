import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // "trade", "queue", "job"
  seq: { type: Number, required: true, default: 0 }
}, { versionKey: false });

export default mongoose.model("Counter", counterSchema);