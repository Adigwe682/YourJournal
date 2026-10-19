
import express from "express";
import authMiddleware from "../Middleware/authMiddleware.js";
import { GetMonthlyReport, CreateShareableReport, GetSharedReport } from "../Controller/reportController.js";




const router = express.Router();

router.get("/", authMiddleware, GetMonthlyReport);

router.post("/share", authMiddleware, CreateShareableReport);

router.get("/shared/:token", GetSharedReport);


export default router;

