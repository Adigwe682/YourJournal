import "dotenv/config"; // first, so env is ready before other imports run
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import tradeRoute from "../Backend/Routes/tradeRoute.js";
import userRoute from "../Backend/Routes/userRoute.js";
import reportRoutes from "./Routes/reportRoutes.js";
import adminRoute from "./Routes/adminRoute.js";
import sanitizeInput from "./Middleware/sanitize.js";
import errorHandler from "./Middleware/errorHandler.js";
import { generalLimiter } from "./Middleware/rateLimiter.js";

const app = express();
const port = process.env.PORT || 4000;

// Don't advertise the framework/server version in response headers
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.removeHeader("Server");
  next();
});

// Behind one reverse proxy (Render). Required for rate limiting to
// see the real client IP; harmless locally.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// Strip NoSQL operators / control chars from every request
app.use(sanitizeInput);

// Throttle abusive clients
app.use(generalLimiter);

app.get("/", (req, res) => res.send("server is active"));

app.use("/users", userRoute);
app.use("/api/trades", tradeRoute);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoute);

// Unknown route -> JSON, never an HTML page the frontend can't parse
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Must be last: turns Multer/Cloudinary/unexpected errors into JSON
app.use(errorHandler);

mongoose.connection.on("disconnected", () => console.log("MongoDB Disconnected"));
mongoose.connection.on("error", (e) => console.error("MongoDB Error:", e.message));

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("MongoDB Connected:", mongoose.connection.name);
    app.listen(port, () => console.log(`server is running on ${port}`));
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  });