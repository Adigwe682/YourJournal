
import userModel from "../Model/userModel.js";

export const GetAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await userModel.countDocuments();

    // Registered users split by role (customer / admin)
    const roleCounts = await userModel.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const byRole = {};
    roleCounts.forEach((entry) => {
      byRole[entry._id || "customer"] = entry.count;
    });

    const recentUsers = await userModel
      .find()
      .select("name email role createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        customers: byRole.customer || 0,
        admins: byRole.admin || 0,
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
