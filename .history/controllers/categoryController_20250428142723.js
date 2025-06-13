// Basic imports
const Category = require("../models/Category");

// Create Category
const createCategory = async (req, res) => {
  try {
    const { name, restaurantId } = req.body;

    if (!req.img) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const existingCategory = await Category.findOne({ name, restaurantId });
    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "This category already exists for this restaurant" });
    }

    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.img.filename
    }`;

    const newCategory = new Category({
      name,
      img: imgUrl,
      restaurantId,
    });

    const savedCategory = await newCategory.save();
    res.status(201).json(savedCategory);
  } catch (err) {
    res.status(500).json({ message: "Error creating category", error: err });
  }
};

// Update Category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imgName, restaurantId } = req.body;

    // Check if new name already exists for the same restaurant
    const existingCategory = await Category.findOne({ name, restaurantId });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res
        .status(400)
        .json({ message: "Category name must be unique for this restaurant" });
    }

    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`;

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: { name, img: imgUrl, restaurantId } },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    res.status(500).json({ message: "Error updating category", error: err });
  }
};

// Delete Category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({ message: "Category has been deleted!" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting category", error: err });
  }
};

// Get Single Category
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (err) {
    res.status(500).json({ message: "Error fetching category", error: err });
  }
};

// Get All Categories (with optional restaurantId filter)
const getCategories = async (req, res) => {
  try {
    const { restaurantId } = req.query;

    let query = {};
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    const categories = await Category.find(query).sort({ createdAt: -1 });

    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ message: "Error fetching categories", error: err });
  }
};

// Export Controllers
module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getCategories,
};
