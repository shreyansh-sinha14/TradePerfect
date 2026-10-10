import mongoose from "mongoose";

const counterpartySchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

export default mongoose.model("Counterparty", counterpartySchema);