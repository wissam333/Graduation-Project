// basic imports
const Product = require("../models/Meal");
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

    // Check if product is cached
    const cachedProduct = productCache.get(productId);
    if (cachedProduct) {
      return res.status(200).json(cachedProduct);
    }

    // Fetch the product from the database
    const oneProduct = await Product.findById(productId);
    if (!oneProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Cache the fetched product
    const productData = oneProduct.toObject();
    productCache.put(productId, productData);

    res.status(200).json(productData);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProducts = async (req, res) => {
  try {
    const qCategory = req.query.categoryId; // Get the categoryId from query parameters (optional)
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // Default to 10 items per page if not provided
    const latest = req.query.latest; // Check if latest is set

    const skip = (page - 1) * pageSize; // Calculate number of items to skip

    const cacheKey = JSON.stringify(
      "products" + qCategory + page + pageSize + latest
    );
    const cachedProducts = cache.get(cacheKey);

    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }

    // Define the query object for filtering products
    let query = {};
    if (qCategory) {
      query = {
        categoryId: qCategory, // Filter by categoryId if provided
      };
    }

    // Build the product query
    let productsQuery = Product.find(query);

    if (latest) {
      productsQuery = productsQuery.sort({ createdAt: -1 }).limit(5); // Get the latest 5 products
    } else {
      productsQuery = productsQuery.skip(skip).limit(pageSize); // Apply pagination
    }

    const Products = await productsQuery;

    const productsCount = latest ? 5 : await Product.countDocuments(query); // Count total products matching the query
    const totalPages = latest ? 1 : Math.ceil(productsCount / pageSize); // If latest, only 1 page

    // Store in cache
    cache.put(cacheKey, {
      products: Products,
      totalPages,
      productsCount,
    });

    // Respond with the products
    res.status(200).json({ products: Products, totalPages, productsCount });
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
};
