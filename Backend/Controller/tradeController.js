import mongoose from "mongoose";
import Trade from "../Model/tradeModel.js";
import challengeModel from "../Model/challengeModel.js";
import { evaluateChallenge } from "../Utils/challenge.js";

export const CreateTrade = async (req, res) => {
  try {
    const tradeData = {
      ...req.body,
      user: req.user,
    };

    // Not a schema field - handled explicitly below
    delete tradeData.challengeId;
    delete tradeData.challenge;

    // Optional: log this trade under the user's active challenge,
    // so its P&L is added to / deducted from the challenge balance.
    const challengeId = String(req.body.challengeId || "").trim();

    if (challengeId) {
      if (!mongoose.Types.ObjectId.isValid(challengeId)) {
        return res.status(400).json({
          success: false,
          message: "Unknown challenge.",
        });
      }

      const challenge = await challengeModel.findOne({
        _id: challengeId,
        user: req.user,
      });

      if (!challenge) {
        return res.status(404).json({
          success: false,
          message: "Challenge not found",
        });
      }

      if (challenge.status !== "active") {
        return res.status(409).json({
          success: false,
          message: "That challenge has finished - new trades can't be logged under it.",
        });
      }

      tradeData.challenge = challenge._id;
    }

    // If an image file was uploaded, attach its path or Cloudinary URL
    if (req.file) {
      tradeData.image = req.file.path; 
    }

    const newTrade = new Trade(tradeData);

    await newTrade.save();

    // The new P&L may have passed or blown the challenge
    if (newTrade.challenge) {
      const challenge = await challengeModel.findById(newTrade.challenge);
      if (challenge) {
        await evaluateChallenge(challenge);
      }
    }

    res.status(201).json({
      success: true,
      data: newTrade,
    });
  } catch (error) {
    console.error("Error in creating trade:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const GetAllTrades = async (req, res) => {
  const { month } = req.query;

  try {
    let filter = {
      user: req.user,
    };

    if (month) {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate);

      endDate.setMonth(endDate.getMonth() + 1);

      filter.date = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const trades = await Trade.find(filter);

    res.status(200).json({
      success: true,
      data: trades,
    });
  } catch (error) {
    console.error("Error in getting trades:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const GetBestPairs = async (req, res) => {
  const { month } = req.query;

  try {
    const startDate = new Date(`${month}-01`);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const bestPairs = await Trade.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user),
          date: {
            $gte: startDate,
            $lt: endDate,
          },
          result: "profit",
        },
      },

      {
        $group: {
          _id: "$pair",
          wins: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          wins: -1,
        },
      },

      {
        $limit: 5,
      },
    ]);

    res.status(200).json({
      success: true,
      data: bestPairs,
    });
  } catch (error) {
    console.error("Error getting best pairs:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const GetSingleTrade = async (req, res) => {
  const { id } = req.params;

  try {
    const trade = await Trade.findOne({
      _id: id,
      user: req.user,
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    res.status(200).json({
      success: true,
      data: trade,
    });
  } catch (error) {
    console.error("Error in getting trade:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const UpdateTrade = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await Trade.findOne({
      _id: id,
      user: req.user,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    // A finished challenge has a frozen trade log, otherwise the
    // recorded result could contradict the stored status.
    if (existing.challenge) {
      const challenge = await challengeModel.findById(existing.challenge);

      if (challenge && challenge.status !== "active") {
        return res.status(409).json({
          success: false,
          message: "This trade belongs to a finished challenge and can't be changed.",
        });
      }
    }

    const updateData = { ...req.body };

    // Never allow re-linking or ownership changes through an edit
    delete updateData.challengeId;
    delete updateData.challenge;
    delete updateData.user;

    if (req.file) {
      updateData.image = req.file.path;
    }

    const updatedTrade = await Trade.findOneAndUpdate(
      {
        _id: id,
        user: req.user,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    // A corrected P&L may change whether the challenge passed or failed
    if (updatedTrade && updatedTrade.challenge) {
      const challenge = await challengeModel.findById(updatedTrade.challenge);
      if (challenge) {
        await evaluateChallenge(challenge);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedTrade,
    });
  } catch (error) {
    console.error("Error in updating trade:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const DeleteTrade = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await Trade.findOne({
      _id: id,
      user: req.user,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    // Same lock rule as edits: a finished challenge keeps its log
    if (existing.challenge) {
      const challenge = await challengeModel.findById(existing.challenge);

      if (challenge && challenge.status !== "active") {
        return res.status(409).json({
          success: false,
          message: "This trade belongs to a finished challenge and can't be deleted.",
        });
      }
    }

    const deletedTrade = await Trade.findOneAndDelete({
      _id: id,
      user: req.user,
    });

    // Removing a trade moves the challenge balance - re-check the
    // result (it can drop to 0 or fall back below the target)
    if (deletedTrade && deletedTrade.challenge) {
      const challenge = await challengeModel.findById(deletedTrade.challenge);
      if (challenge) {
        await evaluateChallenge(challenge);
      }
    }

    res.status(200).json({
      success: true,
      message: "Trade deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleting trade:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};