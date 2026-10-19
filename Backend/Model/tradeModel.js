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