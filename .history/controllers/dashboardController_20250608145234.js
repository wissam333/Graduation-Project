// basic imports
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Restaurant = require("../models/Restaurant");
const Category = require("../models/Category");
const cache = require("memory-cache");

// Utility function for date calculations
const getDateRange = (period) => {
  const now = new Date();
  switch (period) {
    case "today":
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const endOfToday = new Date(now.setHours(23, 59, 59, 999));
      return { start: startOfToday, end: endOfToday };
    case "week":
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { start: startOfWeek, end: endOfWeek };
    case "month":
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return { start: startOfMonth, end: endOfMonth };
    case "year":
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      endOfYear.setHours(23, 59, 59, 999);
      return { start: startOfYear, end: endOfYear };
    default:
      return { start: new Date(0), end: now }; // All time
  }
};

// Main dashboard stats controller
const getDashboardStats = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";

    // Base query for restaurant-specific data
    const baseQuery = isAdmin ? {} : { restaurantId };

    // Get date ranges based on period
    const { startDate, endDate, previousStartDate, previousEndDate } =
      getDateRange(period);

    // Retrieve counts and sales data
    const [
      ordersCount,
      productsCount,
      categoriesCount,
      activeManagers,
      currentSales,
      previousSales,
    ] = await Promise.all([
      Order.countDocuments({
        ...baseQuery,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      Product.countDocuments(baseQuery),
      Category.countDocuments(baseQuery),
      isAdmin
        ? User.countDocuments({ role: "2" })
        : User.countDocuments({ restaurantId, role: "2" }),
      Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: previousStartDate, $lte: previousEndDate },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Calculate trends
    const currentRevenue = currentSales[0]?.totalRevenue || 0;
    const previousRevenue = previousSales[0]?.totalRevenue || 0;
    const revenueTrend = calculateTrend(currentRevenue, previousRevenue);

    const currentOrders = currentSales[0]?.count || 0;
    const previousOrders = previousSales[0]?.count || 0;
    const ordersTrend = calculateTrend(currentOrders, previousOrders);

    const avgOrderValue =
      currentOrders > 0 ? currentRevenue / currentOrders : 0;
    const previousAvg =
      previousOrders > 0 ? previousRevenue / previousOrders : 0;
    const aovTrend = calculateTrend(avgOrderValue, previousAvg);

    // Get popular categories
    const popularCategories = await Order.aggregate([
      {
        $match: { ...baseQuery, createdAt: { $gte: startDate, $lte: endDate } },
      },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.categoryId",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails._id",
          name: { $first: "$categoryDetails.name" },
          count: { $sum: "$products.quantity" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      ordersCount,
      productsCount,
      categoriesCount,
      activeManagers,
      totalRevenue: currentRevenue,
      avgOrderValue,
      revenueTrend,
      ordersTrend,
      aovTrend,
      popularCategories,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const calculateTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Sales analytics by time period
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";

    const { start, end } = getDateRange(period);

    const matchStage = {
      createdAt: { $gte: start, $lte: end },
    };

    if (!isAdmin) {
      matchStage.restaurantId = restaurantId;
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: period === "year" ? "%Y-%m" : "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          totalSales: { $sum: "$amount" },
          orderCount: { $sum: 1 },
          deliveryFees: { $sum: "$deliveryPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(salesData);
  } catch (err) {
    console.error("Sales analytics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Product performance analytics
const getProductPerformance = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";

    const baseQuery = isAdmin ? {} : { restaurantId };

    const topProducts = await Order.aggregate([
      { $match: baseQuery },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$products.productId",
          name: { $first: "$productDetails.title" },
          totalSold: { $sum: "$products.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$products.quantity", "$productDetails.price"],
            },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json(topProducts);
  } catch (err) {
    console.error("Product performance error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Order status distribution
const getOrderStatusDistribution = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";

    const baseQuery = isAdmin ? {} : { restaurantId };

    const statusDistribution = await Order.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json(statusDistribution);
  } catch (err) {
    console.error("Order status error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Customer analytics
const getCustomerAnalytics = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";

    // For restaurant managers, only show customers who ordered from their restaurant
    const customerMatch = isAdmin
      ? {}
      : {
          _id: {
            $in: (await Order.distinct("userId", { restaurantId })).filter(
              (id) => id
            ),
          },
        };

    const customerStats = await User.aggregate([
      { $match: { ...customerMatch, role: "1" } }, // Only regular users (not admins/managers)
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "userId",
          as: "orders",
        },
      },
      {
        $project: {
          _id: 1,
          username: 1,
          email: 1,
          orderCount: { $size: "$orders" },
          totalSpent: { $sum: "$orders.amount" },
          lastOrder: { $max: "$orders.createdAt" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 20 },
    ]);

    res.status(200).json(customerStats);
  } catch (err) {
    console.error("Customer analytics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Comparison metrics (week over week, month over month)
const getComparisonMetrics = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";
    const { type = "week" } = req.query;

    const currentRange = getDateRange(type);
    const previousRange = getDateRange(`previous-${type}`);

    const baseQuery = isAdmin ? {} : { restaurantId };

    const [currentData, previousData] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: currentRange.start, $lte: currentRange.end },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$amount" },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: "$amount" },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: previousRange.start, $lte: previousRange.end },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$amount" },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: "$amount" },
          },
        },
      ]),
    ]);

    const current = currentData[0] || {
      totalSales: 0,
      orderCount: 0,
      avgOrderValue: 0,
    };
    const previous = previousData[0] || {
      totalSales: 0,
      orderCount: 0,
      avgOrderValue: 0,
    };

    const calculateChange = (currentVal, previousVal) => {
      if (previousVal === 0) return currentVal > 0 ? 100 : 0;
      return ((currentVal - previousVal) / previousVal) * 100;
    };

    const metrics = {
      totalSales: {
        current: current.totalSales,
        previous: previous.totalSales,
        change: calculateChange(current.totalSales, previous.totalSales),
      },
      orderCount: {
        current: current.orderCount,
        previous: previous.orderCount,
        change: calculateChange(current.orderCount, previous.orderCount),
      },
      avgOrderValue: {
        current: current.avgOrderValue,
        previous: previous.avgOrderValue,
        change: calculateChange(current.avgOrderValue, previous.avgOrderValue),
      },
    };

    res.status(200).json(metrics);
  } catch (err) {
    console.error("Comparison metrics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Product-specific analytics
const getProductAnalytics = async (req, res) => {
  try {
    const { productId } = req.params;
    const restaurantId = req.user.restaurantId;

    // Verify product belongs to the restaurant (unless admin)
    if (req.user.role !== "0") {
      const product = await Product.findById(productId);
      if (!product || product.restaurantId.toString() !== restaurantId) {
        return res.status(404).json({ message: "Product not found" });
      }
    }

    const now = new Date();
    const thisWeek = getDateRange("week");
    const thisMonth = getDateRange("month");
    const thisYear = getDateRange("year");

    const [allTime, weekly, monthly, yearly] = await Promise.all([
      Order.aggregate([
        {
          $match: { "products.productId": mongoose.Types.ObjectId(productId) },
        },
        { $unwind: "$products" },
        {
          $match: { "products.productId": mongoose.Types.ObjectId(productId) },
        },
        {
          $group: {
            _id: null,
            totalSold: { $sum: "$products.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: [
                  "$products.quantity",
                  { $arrayElemAt: ["$products.price", 0] },
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            "products.productId": mongoose.Types.ObjectId(productId),
            createdAt: { $gte: thisWeek.start, $lte: thisWeek.end },
          },
        },
        { $unwind: "$products" },
        {
          $match: { "products.productId": mongoose.Types.ObjectId(productId) },
        },
        {
          $group: {
            _id: { $dayOfWeek: "$createdAt" },
            totalSold: { $sum: "$products.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: [
                  "$products.quantity",
                  { $arrayElemAt: ["$products.price", 0] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            "products.productId": mongoose.Types.ObjectId(productId),
            createdAt: { $gte: thisMonth.start, $lte: thisMonth.end },
          },
        },
        { $unwind: "$products" },
        {
          $match: { "products.productId": mongoose.Types.ObjectId(productId) },
        },
        {
          $group: {
            _id: { $dayOfMonth: "$createdAt" },
            totalSold: { $sum: "$products.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: [
                  "$products.quantity",
                  { $arrayElemAt: ["$products.price", 0] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            "products.productId": mongoose.Types.ObjectId(productId),
            createdAt: { $gte: thisYear.start, $lte: thisYear.end },
          },
        },
        { $unwind: "$products" },
        {
          $match: { "products.productId": mongoose.Types.ObjectId(productId) },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalSold: { $sum: "$products.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: [
                  "$products.quantity",
                  { $arrayElemAt: ["$products.price", 0] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const productDetails = await Product.findById(productId).populate(
      "categoryId",
      "name"
    );

    res.status(200).json({
      product: productDetails,
      allTime: allTime[0] || { totalSold: 0, totalRevenue: 0 },
      weekly,
      monthly,
      yearly,
    });
  } catch (err) {
    console.error("Product analytics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getDashboardStats,
  getSalesAnalytics,
  getProductPerformance,
  getOrderStatusDistribution,
  getCustomerAnalytics,
  getComparisonMetrics,
  getProductAnalytics,
};
