import Trade from "../Model/tradeModel.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Sum of every P&L logged under a challenge.
// The challenge balance is ALWAYS derived from its trades, so the
// running total can never drift out of sync with the trade log.
export async function sumChallengePnl(challengeId) {
  const [row] = await Trade.aggregate([
    { $match: { challenge: challengeId } },
    { $group: { _id: null, total: { $sum: "$pnl" }, count: { $sum: 1 } } },
  ]);

  return {
    totalPnl: row ? row.total : 0,
    tradeCount: row ? row.count : 0,
  };
}

// Resolve the current status of a challenge:
//   - target reached           -> passed (locked)
//   - balance hit 0            -> failed
//   - duration expired, target not reached -> failed
// Only an active challenge can change; finished ones are frozen.
export async function evaluateChallenge(challenge) {
  const { totalPnl } = await sumChallengePnl(challenge._id);

  if (challenge.status === "active") {
    const balance = challenge.startAmount + totalPnl;
    const targetBalance = challenge.startAmount + challenge.targetAmount;
    const now = Date.now();

    if (balance >= targetBalance) {
      challenge.status = "passed";
      challenge.endedAt = new Date();
    } else if (balance <= 0 || now >= challenge.endDate.getTime()) {
      challenge.status = "failed";
      challenge.endedAt = new Date();
    }

    if (challenge.status !== "active") {
      await challenge.save();
    }
  }

  return challenge;
}

// Shape a challenge for API responses: everything the UI needs
// to render the balance, progress bar and countdown in one go.
export function challengeWithStats(challenge, totalPnl, tradeCount) {
  const targetBalance = challenge.startAmount + challenge.targetAmount;
  const balance = challenge.startAmount + totalPnl;

  const rawProgress =
    challenge.targetAmount > 0 ? (totalPnl / challenge.targetAmount) * 100 : 0;

  const msLeft = challenge.endDate.getTime() - Date.now();

  return {
    ...challenge.toObject(),
    targetBalance,
    balance,
    totalPnl,
    tradeCount,
    progressPct: Math.max(0, Math.min(100, Math.round(rawProgress))),
    daysLeft:
      challenge.status === "active" ? Math.max(0, Math.ceil(msLeft / DAY_MS)) : 0,
  };
}
