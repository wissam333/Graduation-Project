// Basic imports
const Category = require("../models/Category");

// Create Category
const createCategory = async (req, res) => {
  try {
    const { name, restaurantId } = req.body;

    // Check if file is present (uploaded image)
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Check if category already exists for the restaurant
    const existingCategory = await Category.findOne({ name, restaurantId });
    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "This category already exists for this restaurant" });
    }

    // Construct image URL
    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.originalname
    }`;

    // Create new category
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
    const { name, restaurantId } = req.body;

    // Check if category exists
    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // If an image file is uploaded, update the img field
    let imgUrl = existingCategory.img; // Keep old image if no new file is uploaded
    if (req.file) {
      imgUrl = `${req.protocol}://${req.get("host")}/uploads/${
        req.file.originalname
      }`;
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name, img: imgUrl, restaurantId },
      { new: true }
    );

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
