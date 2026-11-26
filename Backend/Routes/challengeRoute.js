import express from "express";

import authMiddleware from "../Middleware/authMiddleware.js";

import {
  CreateChallenge,
  GetMyChallenges,
  GetChallengeDetail,
  QuitChallenge,
  DeleteChallenge,
} from "../Controller/challengeController.js";

const router = express.Router();

router.post("/", authMiddleware, CreateChallenge);
router.get("/", authMiddleware, GetMyChallenges);
router.get("/:id", authMiddleware, GetChallengeDetail);
router.post("/:id/quit", authMiddleware, QuitChallenge);
router.delete("/:id", authMiddleware, DeleteChallenge);

export default router;
