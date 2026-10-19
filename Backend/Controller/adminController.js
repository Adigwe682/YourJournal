
import userModel from "../Model/userModel.js";

export const GetAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await userModel.countDocuments();

    const recentUsers = await userModel
      .find()
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        recentUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load admin dashboard",
    });
  }
};
