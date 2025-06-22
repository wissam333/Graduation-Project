const express = require("express");
const router = express.Router();
const {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getAllRestaurants,
  getRestaurant,
  removeRestaurantFromManager,
  removeRestaurantFromDriver,
  assignManagerToRestaurant,
  assignDriverToRestaurant,
  addUserAsRestaurantManager,
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

// remove Restaurant From Manager
router.delete(
  "/removeRestaurantFromManager/:userId",
  removeRestaurantFromManager
);

// remove Restaurant From Driver
router.delete(
  "/removeRestaurantFromDriver/:userId",
  removeRestaurantFromDriver
);

// Assign Manager To Restaurant
router.post("/assignManagerToRestaurant", assignManagerToRestaurant);

// Assign Driver To Restaurant
router.post("/assignDriverToRestaurant", assignDriverToRestaurant);

// Assign Manager To Restaurant
router.post("/addUserAsRestaurantManager", addUserAsRestaurantManager);

module.exports = router;
