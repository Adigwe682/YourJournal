import challengeModel from "../Model/challengeModel.js";
import Trade from "../Model/tradeModel.js";
import {
  evaluateChallenge,
  sumChallengePnl,
  challengeWithStats,
} from "../Utils/challenge.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Load one challenge owned by this user, with its status resolved.
async function loadChallenge(req, res) {
  const challenge = await challengeModel.findOne({
    _id: req.params.id,
    user: req.user,
  });

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: "Challenge not found",
    });
    return null;
  }

  await evaluateChallenge(challenge);
  return challenge;
}

// POST /api/challenges
export const CreateChallenge = async (req, res) => {
  try {
    const startAmount = Number(req.body.startAmount);
    const targetAmount = Number(req.body.targetAmount);
    const durationDays = Number(req.body.durationDays);

    if (!Number.isFinite(startAmount) || startAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Starting amount must be a number greater than 0.",
      });
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "The amount you want to make must be a number greater than 0.",
      });
    }

    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      return res.status(400).json({
        success: false,
        message: "Duration must be a whole number of days between 1 and 365.",
      });
    }

    // One active challenge at a time
    const existing = await challengeModel.findOne({
      user: req.user,
      status: "active",
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already have an active challenge. Quit it before starting a new one.",
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * DAY_MS);

    const challenge = await challengeModel.create({
      user: req.user,
      startAmount,
      targetAmount,
      durationDays,
      startDate,
      endDate,
    });

    res.status(201).json({
      success: true,
      data: challengeWithStats(challenge, 0, 0),
    });
  } catch (error) {
    // Partial unique index: lost a race to create a second active one
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already have an active challenge. Quit it before starting a new one.",
      });
    }

    console.error("Error creating challenge:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/challenges
export const GetMyChallenges = async (req, res) => {
  try {
    const challenges = await challengeModel
      .find({ user: req.user })
      .sort({ createdAt: -1 });

    const data = [];

    for (const challenge of challenges) {
      // Lazy evaluation so an expired challenge flips to failed
      // on read, without needing a cron job.
      await evaluateChallenge(challenge);
      const { totalPnl, tradeCount } = await sumChallengePnl(challenge._id);
      data.push(challengeWithStats(challenge, totalPnl, tradeCount));
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error getting challenges:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/challenges/:id
export const GetChallengeDetail = async (req, res) => {
  try {
    const challenge = await loadChallenge(req, res);
    if (!challenge) return;

    const { totalPnl, tradeCount } = await sumChallengePnl(challenge._id);

    // Oldest first, with a running balance after each trade
    const trades = await Trade.find({ challenge: challenge._id }).sort({
      date: 1,
      createdAt: 1,
    });

    let running = challenge.startAmount;
    const tradesWithBalance = trades.map((trade) => {
      running += trade.pnl || 0;
      return { ...trade.toObject(), runningBalance: running };
    });

    res.status(200).json({
      success: true,
      data: {
        ...challengeWithStats(challenge, totalPnl, tradeCount),
        trades: tradesWithBalance,
      },
    });
  } catch (error) {
    console.error("Error getting challenge:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// POST /api/challenges/:id/quit
export const QuitChallenge = async (req, res) => {
  try {
    const challenge = await loadChallenge(req, res);
    if (!challenge) return;

    if (challenge.status !== "active") {
      return res.status(409).json({
        success: false,
        message: "This challenge has already finished.",
      });
    }

    challenge.status = "failed";
    challenge.endedAt = new Date();
    await challenge.save();

    const { totalPnl, tradeCount } = await sumChallengePnl(challenge._id);

    res.status(200).json({
      success: true,
      data: challengeWithStats(challenge, totalPnl, tradeCount),
    });
  } catch (error) {
    console.error("Error quitting challenge:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE /api/challenges/:id
export const DeleteChallenge = async (req, res) => {
  try {
    const challenge = await loadChallenge(req, res);
    if (!challenge) return;

    if (challenge.status === "active") {
      return res.status(409).json({
        success: false,
        message: "Quit the challenge before deleting it.",
      });
    }

    // Keep the trades - they stay in the journal, just unlinked
    await Trade.updateMany(
      { challenge: challenge._id },
      { $set: { challenge: null } }
    );
    await challenge.deleteOne();

    res.status(200).json({
      success: true,
      message: "Challenge deleted",
    });
  } catch (error) {
    console.error("Error deleting challenge:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
