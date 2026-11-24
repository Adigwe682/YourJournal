// ============================================
// RATE LIMITING
// --------------------------------------------
//   generalLimiter -> applied to every route in Server.js
//   authLimiter    -> stricter, applied to login/register so
//                     password guessing is heavily throttled
// ============================================

import { rateLimit } from "express-rate-limit";

const buildMessage = (seconds) => ({
  success: false,
  message: `Too many requests. Please try again in ${Math.ceil(seconds / 60)} minute(s).`,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per IP per window
  standardHeaders: "draft-7", // RateLimit-* headers
  legacyHeaders: false, // no X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json(buildMessage(req.rateLimit.resetTime - Date.now()));
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 auth attempts per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(buildMessage(req.rateLimit.resetTime - Date.now()));
  },
});
