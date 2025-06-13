const express = require("express");
const router = express.Router();
const {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getAllRestaurants,
  getRestaurant,
  removeRestaurantFromManager,
} = require("../controllers/restaurantController");

// Add a new restaurant
router.post("/", addRestaurant);

// Update a restaurant
router.put("/:id", updateRestaurant);

// Delete a restaurant
router.delete("/:id", deleteRestaurant);

// Get all restaurants
router.get("/", getAllRestaurants);

// Get single restaurant
router.get("/:id", getRestaurant);

// Get single restaurant
router.delete("/removeRestaurantFromManager/:userId", removeRestaurantFromManager);

module.exports = router;
