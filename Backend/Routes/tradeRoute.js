import express from "express";
import authMiddleware from "../Middleware/authMiddleware.js";
import upload from "../Middleware/upload.js"; // Import the new upload middleware
import sanitizeInput from "../Middleware/sanitize.js";

import {
  CreateTrade,
  GetAllTrades,
  GetSingleTrade,
  UpdateTrade,
  DeleteTrade,
  GetBestPairs
} from "../Controller/tradeController.js";

const router = express.Router();

// upload.single("image") intercepts the file from the form input named "image"
// sanitizeInput runs again after Multer so multipart fields are cleaned too
router.post("/", authMiddleware, upload.single("image"), sanitizeInput, CreateTrade);

router.get("/", authMiddleware, GetAllTrades);
router.get("/best-pairs", authMiddleware, GetBestPairs);
router.get("/:id", authMiddleware, GetSingleTrade);
router.patch("/:id", authMiddleware, upload.single("image"), sanitizeInput, UpdateTrade);
router.delete("/:id", authMiddleware, DeleteTrade);

export default router;