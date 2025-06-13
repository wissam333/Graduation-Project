const natural = require("natural");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const cache = require("memory-cache");
const Product = require("../models/Product");
const { performance } = require("perf_hooks");

// Constants
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
const MAX_RECOMMENDATIONS = 10;
const SIMILAR_USERS_COUNT = 5;

// Utility functions
const textPreprocessor = (text) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .join(" ");

const cosineSimilarity = (vectorA, vectorB) => {
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) return 0;

  const dotProduct = vectorA.reduce(
    (acc, val, i) => acc + val * (vectorB[i] || 0),
    0
  );
  const magnitudeA = Math.sqrt(
    vectorA.reduce((acc, val) => acc + val * val, 0)
  );
  const magnitudeB = Math.sqrt(
    vectorB.reduce((acc, val) => acc + val * val, 0)
  );

  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
};

class RecommendationEngine {
  constructor() {
    this.tfidf = new natural.TfIdf();
  }

  async initializeProductVectors() {
    const startTime = performance.now();
    const products = await Product.find({}).populate("categoryId").lean();

    products.forEach((product) => {
      const text = `${product.title} ${product.desc || ""} ${
        product.categoryId?.name || ""
      }`;
      this.tfidf.addDocument(textPreprocessor(text));
    });

    console.log(`TF-IDF initialized in ${performance.now() - startTime}ms`);
    return products;
  }

  async getProductVector(product) {
    const category = await mongoose
      .model("Category")
      .findById(product.categoryId);
    const text = `${product.title} ${product.desc || ""} ${
      category?.name || ""
    }`;
    return this.tfidf.tfidfs(textPreprocessor(text));
  }
}

const engine = new RecommendationEngine();

// Product Recommendations (Content-Based)
const productRecommendations = async (req, res) => {
  try {
    const { productId } = req.params;
    const cacheKey = `product_recs:${productId}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Get product and all products
    const [product, allProducts] = await Promise.all([
      Product.findById(productId).populate("categoryId").lean(),
      engine.initializeProductVectors(),
    ]);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get product vector
    const productVector = await engine.getProductVector(product);

    // Calculate similarities
    const recommendations = await Promise.all(
      allProducts
        .filter((p) => p._id.toString() !== productId)
        .map(async (otherProduct) => {
          const otherVector = await engine.getProductVector(otherProduct);
          return {
            product: otherProduct,
            similarity: cosineSimilarity(productVector, otherVector),
          };
        })
    );

    // Sort and limit recommendations
    const sortedRecs = recommendations
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_RECOMMENDATIONS)
      .filter((item) => item.similarity > 0);

    // Cache and return
    cache.put(cacheKey, sortedRecs, CACHE_TTL);
    res.status(200).json(sortedRecs);
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({
      message: "Error generating recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// User Recommendations (Collaborative Filtering)
const userRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `user_recs:${userId}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Get user's order history
    const orders = await Order.find({ userId }).lean();

    // Get all product IDs the user has ordered
    const userProductIds = new Set();
    orders.forEach((order) => {
      order.products.forEach((item) => {
        userProductIds.add(item.productId.toString());
      });
    });

    // If no order history, return popular products
    if (userProductIds.size === 0) {
      const popularProducts = await getPopularProducts();
      cache.put(cacheKey, popularProducts, CACHE_TTL);
      return res.status(200).json(popularProducts);
    }

    // Find similar users (who ordered similar products)
    const similarUsers = await Order.aggregate([
      {
        $match: {
          "products.productId": {
            $in: Array.from(userProductIds).map((id) =>
              mongoose.Types.ObjectId(id)
            ),
          },
          userId: { $ne: mongoose.Types.ObjectId(userId) },
        },
      },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: SIMILAR_USERS_COUNT },
    ]);

    if (similarUsers.length === 0) {
      const popularProducts = await getPopularProducts();
      cache.put(cacheKey, popularProducts, CACHE_TTL);
      return res.status(200).json(popularProducts);
    }

    // Get products ordered by similar users that current user hasn't ordered
    const recommendedProducts = await Order.aggregate([
      { $match: { userId: { $in: similarUsers.map((u) => u._id) } } },
      { $unwind: "$products" },
      {
        $match: {
          "products.productId": {
            $nin: Array.from(userProductIds).map((id) =>
              mongoose.Types.ObjectId(id)
            ),
          },
        },
      },
      { $group: { _id: "$products.productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: MAX_RECOMMENDATIONS },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $replaceRoot: { newRoot: "$product" } },
    ]);

    // Cache and return
    cache.put(cacheKey, recommendedProducts, CACHE_TTL);
    res.status(200).json(recommendedProducts);
  } catch (error) {
    console.error("User recommendation error:", error);
    res.status(500).json({
      message: "Error generating user recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper: Get popular products
async function getPopularProducts() {
  return Order.aggregate([
    { $unwind: "$products" },
    { $group: { _id: "$products.productId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: MAX_RECOMMENDATIONS },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $replaceRoot: { newRoot: "$product" } },
  ]);
}

// Category-Based Recommendations
const categoryRecommendations = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const cacheKey = `category_recs:${categoryId}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Get products in same category
    const products = await Product.find({
      categoryId,
      _id: { $ne: req.query.exclude }, // Optional: exclude a specific product
    })
      .limit(MAX_RECOMMENDATIONS)
      .lean();

    // Cache and return
    cache.put(cacheKey, products, CACHE_TTL);
    res.status(200).json(products);
  } catch (error) {
    console.error("Category recommendation error:", error);
    res.status(500).json({
      message: "Error generating category recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  productRecommendations,
  userRecommendations,
  categoryRecommendations,
};
