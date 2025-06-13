// basic imports
const Product = require("../models/Product");
const Category = require("../models/Category");
const Restaurant = require("../models/Restaurant");
const LFUCache = require("../cache/cache");
const productCache = new LFUCache(100);
const cache = require("memory-cache");

// Helper function to invalidate cache for a specific product ID
const invalidateCache = (productId) => {
  productCache.remove(productId);
};

const createProduct = async (req, res) => {
  try {
    // Validation: Check if a product with the same title already exists
    const product = await Product.findOne({ title: req.body.title });

    // Ensure the image file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Get the image file name from req.file
    const imgName = req.file.originalname; // Use the original file name or generate a unique one
    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`; // Construct the complete URL for the image

    // Create a new product object
    const newProduct = new Product({
      title: req.body.title,
      desc: req.body.desc,
      img: imgUrl,
      categoryId: req.body.categoryId,
      price: req.body.price,
      restaurantId: req.body.restaurantId,
    });

    // Check if the product already exists
    if (product) {
      return res
        .status(403)
        .json({ message: "This product is already submitted" });
    }

    // Save the product to the database
    const savedProduct = await newProduct.save();

    // Invalidate cache (if you use caching)
    cache.clear();

    // Return the created product
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(500).json(err);
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Update the image if a new one is provided
    let imgUrl = product.img; // Retain existing image if not updated
    if (req.file) {
      const imgName = req.file.originalname;
      imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`;
    }

    // Update the product with new details
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        $set: {
          title: req.body.title,
          desc: req.body.desc,
          img: imgUrl,
          categoryId: req.body.categoryId,
          price: req.body.price,
          restaurantId: req.body.restaurantId,
        },
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Invalidate cache for updated product
    invalidateCache(id);
    cache.clear();

    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete the product
    await Product.findByIdAndDelete(id);

    // Invalidate cache for the deleted product
    invalidateCache(id);
    cache.clear();

    res.status(200).json({ message: "Product has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Check cache first
    const cachedProduct = productCache.get(productId);
    if (cachedProduct) {
      return res.status(200).json(cachedProduct);
    }

    // Fetch product with necessary populations
    const product = await Product.findById(productId)
      .populate("categoryId", "-__v")
      .populate("restaurantId", "-__v")
      .lean(); // Convert to plain JS object

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Safely build response
    const response = {
      ...product,
      restaurantId:
        product.restaurantId?._id?.toString() || product.restaurantId,
      restaurant: product.restaurantId,
      categoryId: product.categoryId?._id?.toString() || product.categoryId,
      category: product.categoryId,
    };

    // Remove the original populated fields if they exist as objects
    if (typeof product.restaurantId === "object") {
      delete response.restaurantId;
    }
    if (typeof product.categoryId === "object") {
      delete response.categoryId;
    }

    // Cache and respond
    productCache.put(productId, response);
    res.status(200).json(response);
  } catch (err) {
    console.error("Error in getProduct:", err);
    res.status(500).json({
      message: "Server error fetching product",
      error: err.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const { categoryId, restaurantId, page = 1, pageSize = 10, latest } = req.query;
    const skip = (page - 1) * pageSize;

    // Build cache key with restaurantId
    const cacheKey = `products:${categoryId}:${restaurantId}:${page}:${pageSize}:${latest}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Build query
    const query = {};
    if (categoryId) query.categoryId = categoryId;
    if (restaurantId) query.restaurantId = restaurantId;

    let productsQuery = Product.find(query)
      .populate("categoryId", "-__v")
      .populate("restaurantId", "-__v")
      .lean();

    if (latest) {
      productsQuery = productsQuery.sort({ createdAt: -1 }).limit(5);
    } else {
      productsQuery = productsQuery.skip(skip).limit(pageSize);
    }

    // Execute query
    const products = await productsQuery;
    const count = latest ? 5 : await Product.countDocuments(query);

    // Transform products safely
    const transformedProducts = products.map((p) => ({
      ...p,
      restaurantId: p.restaurantId?._id?.toString() || p.restaurantId,
      restaurant: p.restaurantId,
      categoryId: p.categoryId?._id?.toString() || p.categoryId,
      category: p.categoryId,
    }));

    // Remove original fields if they were objects
    transformedProducts.forEach((p) => {
      if (typeof p.restaurantId === "object") delete p.restaurantId;
      if (typeof p.categoryId === "object") delete p.categoryId;
    });

    // Prepare final response
    const response = {
      products: transformedProducts,
      totalPages: latest ? 1 : Math.ceil(count / pageSize),
      productsCount: count,
    };

    // Cache and respond
    cache.put(cacheKey, response);
    res.status(200).json(response);
  } catch (err) {
    console.error("Error in getProducts:", err);
    res.status(500).json({
      message: "Server error fetching products",
      error: err.message,
    });
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
};
