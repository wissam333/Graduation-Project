const express = require("express");
const router = express.Router();
const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getCategories,
} = require("../controllers/categoryController");
const uploadImg = require("../Middleware/multerMiddleware");

// Create a new category
router.post("/", uploadImg, createCategory);

// Get all categories
router.get("/", getCategories);

// Get a single category by ID
router.get("/:id", getCategory);


// Update a category
router.put("/:id", uploadImg, updateCategory);

// Delete a category
router.delete("/:id", deleteCategory);

module.exports = router;
