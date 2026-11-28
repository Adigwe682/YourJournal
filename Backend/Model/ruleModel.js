import mongoose from "mongoose";

const ruleSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // A personal trading rule, in the trader's own words.
        // Free text on purpose - execution rules, psychological
        // rules, risk rules: whatever their brain needs to read.
        text: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 600,
        },

        // Optional screenshots of an ideal pattern / context trade
        // shown as reference next to the rule.
        images: {
            type: [String],
            default: [],
            validate: {
                validator: (images) => images.length <= 6,
                message: "A rule can have at most 6 images",
            },
        },
    },
    {
        timestamps: true,
    }
);

const ruleModel = mongoose.model("Rule", ruleSchema);

export default ruleModel;
