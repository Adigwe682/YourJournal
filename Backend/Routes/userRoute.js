import express from "express";

import {
  CreateUser,
  DeleteUser,
  GetAllUsers,
  GetSingleUser,
  UpdateUser,
  RegisterUser,
  LoginUser,
} from "../Controller/userController.js";

const userRoute = express.Router();

userRoute.post("/new-user", CreateUser);

userRoute.post("/register", RegisterUser);
userRoute.post("/login", LoginUser);

userRoute.get("/all-users", GetAllUsers);
userRoute.get("/get-one-user/:id", GetSingleUser);

userRoute.patch("/update-user/:id", UpdateUser);

userRoute.delete("/delete-user/:id", DeleteUser);

export default userRoute;