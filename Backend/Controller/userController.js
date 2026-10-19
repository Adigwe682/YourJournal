import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import userModel from "../Model/userModel.js";



export const CreateUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide all fields",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error in creating user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export const UpdateUser = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedUser = await userModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in updating user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const DeleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await userModel.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleting user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const GetAllUsers = async (req, res) => {
  try {
    const users = await userModel.find();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error in getting users:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export const GetSingleUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error in getting user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




// Login Authetication
export const LoginUser = async (req, res) => {
  const { email, password } = req.body;

  console.log(
    "MongoDB state before login query:",
    mongoose.connection.readyState
  );

  try {
    await mongoose.connection.asPromise();

    console.log(
      "MongoDB state after reconnect attempt:",
      mongoose.connection.readyState
    );

    console.log(
      "MongoDB state before login query:",
      mongoose.connection.readyState
    );

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    console.log(
      "MongoDB state before findOne:",
      mongoose.connection.readyState
    );

    const user = await userModel.findOne({ email });

    console.log("User query completed");

    // the rest of your code...

    // rest of your code...
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Compare entered password with hashed password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in logging in user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//Register logic.

export const RegisterUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error in registering user:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};