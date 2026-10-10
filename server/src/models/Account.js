import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
}, { timestamps: true, versionKey: false });

export default mongoose.model("Account", accountSchema);