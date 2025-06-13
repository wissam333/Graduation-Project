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

    // Check if product is cached
    const cachedProduct = productCache.get(productId);
    if (cachedProduct) {
      return res.status(200).json(cachedProduct);
    }

    // Fetch the product from the database with populated category and restaurant
    const oneProduct = await Product.findById(productId)
      .populate("categoryId", "-__v") // Exclude version key
      .populate("restaurantId", "-__v"); // Exclude version key

    if (!oneProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Convert to object and include both ID and populated object
    const productData = oneProduct.toObject();
    productData.restaurant = productData.restaurantId;
    productData.restaurantId = oneProduct.restaurantId._id;
    productData.category = productData.categoryId;
    productData.categoryId = oneProduct.categoryId._id;

    // Cache the fetched product
    productCache.put(productId, productData);

    res.status(200).json(productData);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getProducts = async (req, res) => {
  try {
    const qCategory = req.query.categoryId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const latest = req.query.latest;

    const skip = (page - 1) * pageSize;

    const cacheKey = JSON.stringify(
      "products" + qCategory + page + pageSize + latest
    );
    const cachedProducts = cache.get(cacheKey);

    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }

    let query = {};
    if (qCategory) {
      query = { categoryId: qCategory };
    }

    // Build the product query with population
    let productsQuery = Product.find(query)
      .populate("categoryId", "-__v")
      .populate("restaurantId", "-__v");

    if (latest) {
      productsQuery = productsQuery.sort({ createdAt: -1 }).limit(5);
    } else {
      productsQuery = productsQuery.skip(skip).limit(pageSize);
    }

    const products = await productsQuery;

    // Transform each product to include both ID and populated object
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      return {
        ...productObj,
        restaurant: productObj.restaurantId,
        restaurantId: product.restaurantId._id,
        category: productObj.categoryId,
        categoryId: product.categoryId._id
      };
    });

    const productsCount = latest ? 5 : await Product.countDocuments(query);
    const totalPages = latest ? 1 : Math.ceil(productsCount / pageSize);

    // Store in cache
    cache.put(cacheKey, {
      products: transformedProducts,
      totalPages,
      productsCount,
    });

    res.status(200).json({ 
      products: transformedProducts, 
      totalPages, 
      productsCount 
    });
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
