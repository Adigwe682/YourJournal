
import userModel from "../Model/userModel.js";

const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user;

    const user = await userModel.findById(userId).select("role");

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error("Admin authorization error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export default adminMiddleware;
