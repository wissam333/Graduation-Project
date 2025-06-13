const express = require("express");
const router = express.Router();
const {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} = require("../controllers/categoryController");

// Create a new category
router.post("/", createCategory);

// Get all categories
router.get("/", getAllCategories);

// Get a single category by ID
router.get("/:id", getCategoryById);

// Update a category
router.put("/:id", updateCategory);

// Delete a category
router.delete("/:id", deleteCategory);

module.exports = router;
