const express = require("express");
const router = express.Router();
const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getCategories,
} = require("../controllers/categoryController");

// Create a new category
router.post("/", createCategory);

// Get all categories
router.get("/", getCategories);

// Get a single category by ID
router.get("/:id", getCategory);

// Update a category
router.put("/:id", updateCategory);

// Delete a category
router.delete("/:id", deleteCategory);

module.exports = router;
