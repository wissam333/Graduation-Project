const express = require("express");
const router = express.Router();
const {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocation,
  getLocations,
} = require("../controllers/locationController");

router.post("/", createLocation); // Create a new location
router.put("/:id", updateLocation); // Update a location by id
router.delete("/:id", deleteLocation); // Delete a location by id
router.get("/:id", getLocation); // Get a location by id
router.get("/", getLocations); // Get all locations (with optional filtering)

module.exports = router;
