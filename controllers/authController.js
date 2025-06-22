//basic imports
const User = require("../models/User");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const Restaurant = require("../models/Restaurant");

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
      {
        id: savedUser._id,
        role: savedUser.role,
        restaurantId: savedUser.restaurantId,
      },
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
      { id: user._id, role: user.role, restaurantId: user.restaurantId },
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
    const { username, email, password, restaurantId } = req.body;

    // Validate required fields
    if (!username || !email || !password || !restaurantId) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: username, email, password, restaurantId",
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Find restaurant (without checking createdBy)
    const restaurant = await Restaurant.findById(restaurantId).select(
      "-createdBy"
    );
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Create manager
    const newManager = new User({
      username,
      email,
      password: CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString(),
      role: "2",
      restaurantId,
    });

    const savedManager = await newManager.save();

    // Update restaurant (without modifying createdBy)
    await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $addToSet: { managers: savedManager._id } },
      { runValidators: false } // Skip validation to avoid createdBy requirement
    );

    // Generate token
    const accessToken = jwt.sign(
      {
        id: savedManager._id,
        role: savedManager.role,
        restaurantId: savedManager.restaurantId,
      },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    // Return response
    const { password: _, ...userData } = savedManager.toObject();

    res.status(201).json({
      success: true,
      message: "Manager registered successfully",
      data: {
        user: userData,
        accessToken,
        restaurant: {
          _id: restaurant._id,
          name: restaurant.name,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to register manager",
      error: err.message,
    });
  }
};

const registerDriver = async (req, res) => {
  try {
    const { username, email, password, restaurantId } = req.body;

    // Validate required fields
    if (!username || !email || !password || !restaurantId) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: username, email, password, restaurantId",
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Find restaurant (without checking createdBy)
    const restaurant = await Restaurant.findById(restaurantId).select(
      "-createdBy"
    );
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Create manager
    const newManager = new User({
      username,
      email,
      password: CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString(),
      role: "3",
      restaurantId,
    });

    const savedManager = await newManager.save();

    // Update restaurant (without modifying createdBy)
    await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $addToSet: { managers: savedManager._id } },
      { runValidators: false } // Skip validation to avoid createdBy requirement
    );

    // Generate token
    const accessToken = jwt.sign(
      {
        id: savedManager._id,
        role: savedManager.role,
        restaurantId: savedManager.restaurantId,
      },
      process.env.JWT_SEC,
      { expiresIn: "3d" }
    );

    // Return response
    const { password: _, ...userData } = savedManager.toObject();

    res.status(201).json({
      success: true,
      message: "Manager registered successfully",
      data: {
        user: userData,
        accessToken,
        restaurant: {
          _id: restaurant._id,
          name: restaurant.name,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to register manager",
      error: err.message,
    });
  }
};

module.exports = { register, login, registerManager, registerDriver };
