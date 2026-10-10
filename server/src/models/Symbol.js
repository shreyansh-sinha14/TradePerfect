import mongoose from "mongoose";

const symbolSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

export default mongoose.model("Symbol", symbolSchema);