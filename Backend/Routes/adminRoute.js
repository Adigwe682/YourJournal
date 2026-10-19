
import express from "express";

import authMiddleware from "../Middleware/authMiddleware.js";
import adminMiddleware from "../Middleware/adminMiddleware.js";

import { GetAdminDashboard } from "../Controller/adminController.js";

const adminRoute = express.Router();

adminRoute.get(
  "/dashboard",
  authMiddleware,
  adminMiddleware,
  GetAdminDashboard
);

export default adminRoute;
