import express from "express";

import authMiddleware from "../Middleware/authMiddleware.js";
import upload from "../Middleware/upload.js";
import sanitizeInput from "../Middleware/sanitize.js";

import {
  CreateRule,
  GetRules,
  UpdateRule,
  DeleteRule,
} from "../Controller/ruleController.js";

const router = express.Router();

// upload.array("images", 6) - optional screenshots, max 6, same
// 10 MB + image-only rules as trade screenshots
router.post("/", authMiddleware, upload.array("images", 6), sanitizeInput, CreateRule);
router.get("/", authMiddleware, GetRules);
router.patch("/:id", authMiddleware, upload.array("images", 6), sanitizeInput, UpdateRule);
router.delete("/:id", authMiddleware, DeleteRule);

export default router;
