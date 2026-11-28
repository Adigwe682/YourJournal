import ruleModel from "../Model/ruleModel.js";

const MAX_IMAGES = 6;

// Accepts an optional JSON field the client uses to say which
// existing image URLs to keep when editing (everything else is
// dropped). Missing field = keep the current images unchanged.
function parseKeepImages(req, currentImages) {
  if (typeof req.body.keepImages !== "string") {
    return currentImages;
  }

  try {
    const parsed = JSON.parse(req.body.keepImages);
    if (!Array.isArray(parsed)) return currentImages;

    return parsed
      .filter((url) => typeof url === "string" && url.length <= 500)
      .slice(0, MAX_IMAGES);
  } catch {
    return currentImages;
  }
}

function uploadedUrls(req) {
  return (req.files || []).map((file) => file.path);
}

// POST /api/rules
export const CreateRule = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();

    if (text.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Write your rule before saving.",
      });
    }

    if (text.length > 600) {
      return res.status(400).json({
        success: false,
        message: "Rules can be at most 600 characters.",
      });
    }

    const images = uploadedUrls(req).slice(0, MAX_IMAGES);

    const rule = await ruleModel.create({ user: req.user, text, images });

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Error creating rule:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/rules
export const GetRules = async (req, res) => {
  try {
    // Oldest first, so the checklist order stays stable
    const rules = await ruleModel.find({ user: req.user }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error("Error getting rules:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// PATCH /api/rules/:id
export const UpdateRule = async (req, res) => {
  try {
    const rule = await ruleModel.findOne({ _id: req.params.id, user: req.user });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    if (typeof req.body.text === "string") {
      const text = req.body.text.trim();

      if (text.length < 2) {
        return res.status(400).json({
          success: false,
          message: "A rule can't be empty.",
        });
      }

      if (text.length > 600) {
        return res.status(400).json({
          success: false,
          message: "Rules can be at most 600 characters.",
        });
      }

      rule.text = text;
    }

    // Images: kept ones from the client + newly uploaded files,
    // capped at the limit either way.
    const kept = parseKeepImages(req, rule.images);
    rule.images = [...kept, ...uploadedUrls(req)].slice(0, MAX_IMAGES);

    await rule.save();

    res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Error updating rule:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE /api/rules/:id
export const DeleteRule = async (req, res) => {
  try {
    const rule = await ruleModel.findOneAndDelete({
      _id: req.params.id,
      user: req.user,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Rule deleted",
    });
  } catch (error) {
    console.error("Error deleting rule:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
