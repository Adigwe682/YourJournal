import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Capital the challenge starts with
        startAmount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        // Profit target: the amount the trader wants to make
        // by the milestone (added on top of startAmount).
        targetAmount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        // How long they want to trade, in days
        durationDays: {
            type: Number,
            required: true,
            min: 1,
        },

        startDate: {
            type: Date,
            default: Date.now,
        },

        // Computed at creation: startDate + durationDays
        endDate: {
            type: Date,
            required: true,
        },

        status: {
            type: String,
            enum: ["active", "passed", "failed"],
            default: "active",
        },

        // Set when the challenge passes or fails
        endedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// One active challenge per user, enforced at the database level
// (history of finished challenges stays intact).
challengeSchema.index(
    { user: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: "active" } }
);

const challengeModel = mongoose.model("Challenge", challengeSchema);

export default challengeModel;
