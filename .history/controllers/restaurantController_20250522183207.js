const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

// Helper to validate location (must be in [longitude, latitude] format)
const isValidLocation = (location) => {
  return (
    Array.isArray(location) &&
    location.length === 2 &&
    !isNaN(location[0]) && // longitude is a number
    !isNaN(location[1]) // latitude is a number
  );
};

// Add a new restaurant
const addRestaurant = async (req, res) => {
  try {
    const { name, location } = req.body;

    // Validate location format
    if (!isValidLocation(location)) {
      return res.status(400).json({ message: "Invalid location format" });
    }

    // Check if restaurant already exists
    const existingRestaurant = await Restaurant.findOne({ name });
    if (existingRestaurant) {
      return res.status(400).json({ message: "Restaurant already exists" });
    }

    // Create new restaurant
    const newRestaurant = new Restaurant({
      name,
      location,
    });

    // Save to database
    const savedRestaurant = await newRestaurant.save();

    res.status(201).json(savedRestaurant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a restaurant
const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location } = req.body;

    // Validate location format
    if (location && !isValidLocation(location)) {
      return res.status(400).json({ message: "Invalid location format" });
    }

    // Check if the restaurant exists
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Check if the new name is already taken by another restaurant
    if (name && name !== restaurant.name) {
      const nameExists = await Restaurant.findOne({ name });
      if (nameExists) {
        return res
          .status(400)
          .json({ message: "Restaurant name already in use" });
      }
    }

    // Update the restaurant
    restaurant.name = name || restaurant.name;
    restaurant.location = location || restaurant.location;

    const updatedRestaurant = await restaurant.save();

    res.json(updatedRestaurant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a restaurant
const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRestaurant = await Restaurant.findByIdAndDelete(id);

    if (!deletedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all restaurants
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single restaurant
const getRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeRestaurantFromManager = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is actually a manager with restaurant assignment
    if (user.role !== "2" || !user.restaurantId) {
      return res.status(400).json({
        success: false,
        message: "User is not a manager or has no restaurant assignment",
      });
    }

    const restaurantId = user.restaurantId;

    // Remove manager from restaurant's managers array
    await Restaurant.findByIdAndUpdate(restaurantId, {
      $pull: { managers: userId },
    });

    // Update user - remove restaurantId and change role to regular user (1)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $unset: { restaurantId: 1 }, // Remove restaurantId field
        $set: { role: "1" }, // Demote to regular user
      },
      { new: true, select: "-password" }
    );

    res.status(200).json({
      success: true,
      message: "Restaurant assignment removed successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to remove restaurant assignment",
      error: err.message,
    });
  }
};

const assignManagerToRestaurant = async (req, res) => {
  try {
    const { restaurantId, userId } = req.body;

    // Check if both IDs are provided
    if (!restaurantId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Both restaurantId and userId are required",
      });
    }

    // Check if the user exists and has role 2 (manager)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.role !== "2") {
      return res.status(400).json({
        success: false,
        message: "User is not a manager (role must be 2)",
      });
    }

    // Check if the restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Update the restaurant to include the manager
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        $addToSet: { managers: userId },
      },
      { new: true }
    );

    // Update the user to reference the restaurant
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        restaurantId: restaurantId,
      },
      { new: true, select: "-password" }
    );

    res.status(200).json({
      success: true,
      message: "Manager assigned to restaurant successfully",
      data: {
        restaurant: updatedRestaurant,
        user: updatedUser,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to assign manager to restaurant",
      error: err.message,
    });
  }
};

module.exports = {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getAllRestaurants,
  getRestaurant,
  removeRestaurantFromManager,
  assignManagerToRestaurant,
};
