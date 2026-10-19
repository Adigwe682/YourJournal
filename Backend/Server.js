import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import tradeRoute from "../Backend/Routes/tradeRoute.js";
import userRoute from "../Backend/Routes/userRoute.js";
import reportRoutes from "./Routes/reportRoutes.js";

import adminRoute from "./Routes/adminRoute.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(port, () => {
      console.log(`server is running on ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
  });

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB Disconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB Error:", error.message);
});

app.get("/", (req, res) => {
  res.send("server is active");
});

app.use("/users", userRoute);
app.use("/api/trades", tradeRoute);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoute);
