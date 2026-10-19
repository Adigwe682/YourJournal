import express from "express";
import authMiddleware from "../Middleware/authMiddleware.js";

import {
  CreateTrade,
  GetAllTrades,
  GetSingleTrade,
  UpdateTrade,
  DeleteTrade,
  GetBestPairs
} from "../Controller/tradeController.js";

const router = express.Router();

router.post("/", authMiddleware, CreateTrade);

router.get("/", authMiddleware, GetAllTrades);

router.get("/best-pairs", authMiddleware, GetBestPairs);

router.get("/:id", authMiddleware, GetSingleTrade);

router.patch("/:id", authMiddleware, UpdateTrade);

router.delete("/:id", authMiddleware, DeleteTrade);

export default router;