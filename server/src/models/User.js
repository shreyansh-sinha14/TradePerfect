import mongoose from "mongoose";
import { ROLES } from "@tradeperfect/shared";

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { 
  timestamps: true,
  versionKey: false 
});

export default mongoose.model("User", userSchema);