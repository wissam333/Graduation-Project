// Basic imports
const Category = require("../models/Category");
const Restaurant = require("../models/Restaurant");

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

// Get Single Category with its complete restaurant
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Get the full restaurant document
    const restaurant = await Restaurant.findById(category.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Combine category and restaurant data
    const response = {
      ...category.toObject(),
      restaurant: restaurant,
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ message: "Error fetching category", error: err });
  }
};

// Get All Categories with their complete restaurants
const getCategories = async (req, res) => {
  try {
    const { restaurantId } = req.query;

    let query = {};
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    const categories = await Category.find(query).sort({ createdAt: -1 });

    // Get all restaurants for these categories
    const restaurantIds = categories.map((c) => c.restaurantId);
    const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } });

    // Combine categories with their restaurants
    const categoriesWithRestaurants = categories.map((category) => {
      const restaurant = restaurants.find((r) =>
        r._id.equals(category.restaurantId)
      );
      return {
        ...category.toObject(),
        restaurant: restaurant || null,
      };
    });

    res.status(200).json(categoriesWithRestaurants);
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
