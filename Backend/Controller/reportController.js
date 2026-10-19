

import Report from "../Model/reportModel.js";
import { randomBytes } from "crypto";
import Trade from "../Model/tradeModel.js";
export const GetMonthlyReport = async (req, res) => {
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
            success: false,
            message: "A valid month is required (YYYY-MM).",
        });
    }

    try {
        const startDate = new Date(`${month}-01`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const trades = await Trade.find({
            user: req.user,
            date: {
                $gte: startDate,
                $lt: endDate,
            },
        });

        const totalTrades = trades.length;
        const wins = trades.filter((trade) => trade.result === "profit");
        const losses = trades.filter((trade) => trade.result === "loss");

        const totalPnl = trades.reduce(
            (total, trade) => total + Number(trade.pnl || 0),
            0
        );

        const winRate =
            totalTrades > 0
                ? Number(((wins.length / totalTrades) * 100).toFixed(1))
                : 0;

        const pairWins = {};

        wins.forEach((trade) => {
            pairWins[trade.pair] = (pairWins[trade.pair] || 0) + 1;
        });

        const bestPairs = Object.entries(pairWins)
            .map(([pair, count]) => ({ pair, wins: count }))
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 5);

        return res.status(200).json({
            success: true,
            data: {
                month,
                totalTrades,
                wins: wins.length,
                losses: losses.length,
                winRate,
                totalPnl,
                bestPairs,
            },
        });
    } catch (error) {
        console.error("Error generating monthly report:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not generate monthly report.",
        });
    }
};


export const CreateShareableReport = async (req, res) => {
    const { month } = req.body;

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
            success: false,
            message: "A valid month is required (YYYY-MM).",
        });
    }

    try {
        const shareToken = randomBytes(24).toString("hex");

        const report = await Report.create({
            user: req.user,
            month,
            shareToken,
            isPublic: true,
        });

        return res.status(201).json({
            success: true,
            message: "Shareable report created successfully.",
            data: {
                month: report.month,
                shareToken: report.shareToken,
                sharePath: `/api/reports/shared/${report.shareToken}`,
            },
        });
    } catch (error) {
        console.error("Error creating shareable report:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not create shareable report.",
        });
    }
};

export const GetSharedReport = async (req, res) => {
  const { token } = req.params;

  try {
    const report = await Report.findOne({
      shareToken: token,
      isPublic: true,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Shared report not found or no longer available.",
      });
    }

    const startDate = new Date(`${report.month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const trades = await Trade.find({
      user: report.user,
      date: {
        $gte: startDate,
        $lt: endDate,
      },
    });

    const totalTrades = trades.length;
    const wins = trades.filter((trade) => trade.result === "profit");
    const losses = trades.filter((trade) => trade.result === "loss");

    const totalPnl = trades.reduce(
      (total, trade) => total + Number(trade.pnl || 0),
      0
    );

    const winRate =
      totalTrades > 0
        ? Number(((wins.length / totalTrades) * 100).toFixed(1))
        : 0;

    const pairWins = {};

    wins.forEach((trade) => {
      pairWins[trade.pair] = (pairWins[trade.pair] || 0) + 1;
    });

    const bestPairs = Object.entries(pairWins)
      .map(([pair, count]) => ({ pair, wins: count }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        month: report.month,
        totalTrades,
        wins: wins.length,
        losses: losses.length,
        winRate,
        totalPnl,
        bestPairs,
      },
    });
  } catch (error) {
    console.error("Error retrieving shared report:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve shared report.",
    });
  }
};

