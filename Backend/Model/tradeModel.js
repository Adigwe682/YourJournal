import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema(
    {
        pair: {
            type: String,
            required: true,
            trim: true,
        },
        rr: {
            type: Number,
            required: true,
        },
        pnl: {
            type: Number,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        result: {
            type: String,
            enum: ["profit", "loss", "breakeven"],
            required: true,
        },
        direction: {
            type: String,
            enum: ["buy", "sell", ""],
            default: "",
        },
        session: {
            type: String,
            enum: ["London", "New York", "Asia", "Other", ""],
            default: "",
        },
        setupTag: {
            type: String,
            trim: true,
            default: "",
        },
        psychology: {
            type: String,
            enum: ["Followed Plan", "FOMO", "Revenge Trade", "Early Exit", "Over-leveraged", ""],
            default: "Followed Plan",
        },
        criteria: {
            type: String,
            trim: true,
        },
        image: {
            type: String,
        },
        // Optional: links this trade to a challenge so its P&L
        // counts toward that challenge's running balance.
        challenge: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Challenge",
            default: null,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

const tradeModel = mongoose.model("Trade", tradeSchema);

export default tradeModel;