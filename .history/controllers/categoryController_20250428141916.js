const Category = require("../models/Category");

// Create a new Category (with image upload)
const createCategory = async (req, res) => {
  try {
    const existingCategory = await Category.findOne({ name: req.body.name });
    if (existingCategory) {
      return res
        .status(403)
        .json({ message: "This category is already submitted" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }
    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
    const newCategory = new Category({
      name: req.body.name,
      img: imgUrl,
    });
    const savedCategory = await newCategory.save();
    res.status(201).json(savedCategory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an existing Category (with optional new image)
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const img = req.file ? req.file.filename : undefined;

    const updatedFields = { ...(name && { name }) };
    if (img) {
      updatedFields.img = img;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete a Category
const deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get a single Category by ID
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all Categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getAllCategories,
};
