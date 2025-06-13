const Restaurant = require("../models/Restaurant");

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

module.exports = {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getAllRestaurants,
  getRestaurant,
};
