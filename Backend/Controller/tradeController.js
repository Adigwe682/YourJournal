
import mongoose from "mongoose";
import Trade from "../Model/tradeModel.js";

export const CreateTrade = async (req, res) => {
  const trade = {
    ...req.body,
    user: req.user,
  };

  try {
    const newTrade = new Trade(trade);

    await newTrade.save();

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
    const updatedTrade = await Trade.findOneAndUpdate(
      {
        _id: id,
        user: req.user,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTrade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
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
    const deletedTrade = await Trade.findOneAndDelete({
      _id: id,
      user: req.user,
    });

    if (!deletedTrade) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
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