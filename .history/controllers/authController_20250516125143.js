//basic imports
const User = require("../models/User");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const register = async (req, res) => {
  try {
    // validations
    const userEmail = await User.findOne({ email: req.body.email });
    const username = await User.findOne({ username: req.body.username });

    if (username)
      return res
        .status(401)
        .json({ success: false, message: "This username is already used" });
    if (userEmail)
      return res
        .status(401)
        .json({ success: false, message: "This email is already used" });

    // Check if this is the first user
    const isFirstUser = (await User.countDocuments({})) === 0;

    // create new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: CryptoJS.AES.encrypt(
        req.body.password,
        process.env.PASS_SEC
      ).toString(),
      role: isFirstUser ? "0" : "1",
    });

    // save user in database
    const savedUser = await newUser.save();

    // Generate an access token for the new user
    const accessToken = jwt.sign(
      { id: savedUser._id, role: savedUser.role },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    // Remove the password field from the user object
    const { password, ...userWithoutPassword } = savedUser.toObject();

    // Return the user object along with the access token
    res.status(201).json({
      success: true,
      data: { ...userWithoutPassword, accessToken },
      message: "User registered successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: err.message,
    });
  }
};

const login = async (req, res) => {
  try {
    // validations
    const user = await User.findOne({ username: req.body.username });
    if (!user)
      return res.status(401).json({
        success: false,
        message: "Username not found",
      });

    // password verification
    const hashedPassword = CryptoJS.AES.decrypt(
      user.password,
      process.env.PASS_SEC
    );
    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);
    if (originalPassword !== req.body.password)
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SEC,
      { expiresIn: "2d" }
    );

    const { password, ...others } = user._doc; // because mongo stores the document inside _doc

    res.status(200).json({
      success: true,
      data: { ...others, accessToken },
      message: "Login successful",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: err.message,
    });
  }
};

const registerManager = async (req, res) => {
  try {
    // validations
    const userEmail = await User.findOne({ email: req.body.email });
    const username = await User.findOne({ username: req.body.username });

    if (username)
      return res
        .status(401)
        .json({ success: false, message: "This username is already used" });
    if (userEmail)
      return res
        .status(401)
        .json({ success: false, message: "This email is already used" });

    // create new user with role 2 (basic user)
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: CryptoJS.AES.encrypt(
        req.body.password,
        process.env.PASS_SEC
      ).toString(),
      role: "2", // Set role to 2 for basic users
    });

    // save user in database
    const savedUser = await newUser.save();

    // Generate an access token for the new user
    const accessToken = jwt.sign(
      { id: savedUser._id, role: savedUser.role },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    // Remove the password field from the user object
    const { password, ...userWithoutPassword } = savedUser.toObject();

    // Return the user object along with the access token
    res.status(201).json({
      success: true,
      data: { ...userWithoutPassword, accessToken },
      message: "Basic user registered successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: err.message,
    });
  }
};




module.exports = { register, login, registerManager };
