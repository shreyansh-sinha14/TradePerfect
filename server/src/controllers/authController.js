import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { unauthorized, badRequest } from "../utils/AppError.js";
import { toUserDTO } from "../utils/toDto.js";

export const authController = {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return next(badRequest("Username and password are required."));
      }

      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user || !user.active) {
        return next(unauthorized("Invalid username or password."));
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return next(unauthorized("Invalid username or password."));
      }

      const token = jwt.sign(
        { sub: user.userId, name: user.name, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
      );

      res.status(200).json({
        token,
        user: toUserDTO(user)
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await User.findOne({ userId: req.user.userId });
      if (!user || !user.active) {
        return next(unauthorized("User not found or inactive."));
      }
      res.status(200).json({ user: toUserDTO(user) });
    } catch (err) {
      next(err);
    }
  }
};