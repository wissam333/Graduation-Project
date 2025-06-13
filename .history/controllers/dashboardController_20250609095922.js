const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Restaurant = require("../models/Restaurant");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const cache = require("memory-cache");

// Enhanced date range calculation with caching
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate, previousStartDate, previousEndDate;

  switch (period) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(startDate.getDate() - 1);
      previousEndDate = new Date(endDate);
      previousEndDate.setDate(endDate.getDate() - 1);
      break;
    case "week":
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(startDate.getDate() - 7);
      previousEndDate = new Date(endDate);
      previousEndDate.setDate(endDate.getDate() - 7);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
      previousEndDate.setHours(23, 59, 59, 999);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
      previousEndDate.setHours(23, 59, 59, 999);
      break;
    default:
      throw new Error("Invalid period");
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
};

// Main dashboard stats with better data structure
const getDashboardStats = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const restaurantId = req.user.restaurantId;
    console.log(restaurantId);
    const isAdmin = req.user.role === "0";
    const cacheKey = `dashboardStats_${restaurantId || "admin"}_${period}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const { startDate, endDate, previousStartDate, previousEndDate } =
      getDateRange(period);
    const baseQuery = isAdmin ? {} : { restaurantId };

    // Main data aggregation
    const [currentData, previousData, counts, popularCategories] =
      await Promise.all([
        // Current period data
        Order.aggregate([
          {
            $match: {
              ...baseQuery,
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $facet: {
              sales: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                  },
                },
              ],
              byDay: [
                {
                  $group: {
                    _id: {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { _id: 1 } },
              ],
            },
          },
        ]),
        // Previous period data for comparison
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
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        // Counts data
        Promise.all([
          Product.countDocuments(baseQuery),
          Category.countDocuments(baseQuery),
          isAdmin
            ? User.countDocuments({ role: "2" })
            : User.countDocuments({ restaurantId, role: "2" }),
        ]),
        // Popular categories
        Order.aggregate([
          {
            $match: {
              ...baseQuery,
              createdAt: { $gte: startDate, $lte: endDate },
            },
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
              revenue: {
                $sum: {
                  $multiply: ["$products.quantity", "$productDetails.price"],
                },
              },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
      ]);

    // Process results
    const current = currentData[0];
    const currentSales = current?.sales[0] || { total: 0, count: 0 };
    const previousSales = previousData[0] || { total: 0, count: 0 };
    const [productsCount, categoriesCount, activeManagers] = counts;

    // Calculate trends with better handling of edge cases
    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      const change = ((current - previous) / previous) * 100;
      return Math.round(change * 10) / 10; // Round to 1 decimal place
    };

    const result = {
      summary: {
        totalRevenue: currentSales.total,
        ordersCount: currentSales.count,
        avgOrderValue:
          currentSales.count > 0 ? currentSales.total / currentSales.count : 0,
        productsCount,
        categoriesCount,
        activeManagers,
        revenueTrend: calculateTrend(currentSales.total, previousSales.total),
        ordersTrend: calculateTrend(currentSales.count, previousSales.count),
        aovTrend: calculateTrend(
          currentSales.count > 0 ? currentSales.total / currentSales.count : 0,
          previousSales.count > 0
            ? previousSales.total / previousSales.count
            : 0
        ),
      },
      charts: {
        salesTrend:
          current?.byDay?.map((day) => ({
            date: day._id,
            total: day.total,
            count: day.count,
          })) || [],
        popularCategories: popularCategories.map((cat) => ({
          id: cat._id,
          name: cat.name,
          count: cat.count,
          revenue: cat.revenue,
        })),
      },
    };

    // Cache for 5 minutes
    cache.put(cacheKey, result, 5 * 60 * 1000);
    res.status(200).json(result);
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Enhanced sales analytics with better period handling
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";
    const cacheKey = `salesAnalytics_${restaurantId || "admin"}_${period}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const { startDate, endDate } = getDateRange(period);
    const baseQuery = isAdmin ? {} : { restaurantId };

    // Determine grouping format based on period
    let groupFormat;
    if (period === "today") groupFormat = "%H:00";
    else if (period === "week") groupFormat = "%Y-%m-%d";
    else if (period === "month") groupFormat = "%Y-%m-%d";
    else groupFormat = "%Y-%m";

    const salesData = await Order.aggregate([
      {
        $match: { ...baseQuery, createdAt: { $gte: startDate, $lte: endDate } },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          totalSales: { $sum: "$amount" },
          orderCount: { $sum: 1 },
          deliveryFees: { $sum: "$deliveryPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Format results for frontend
    const result = salesData.map((item) => ({
      date: item._id,
      totalSales: item.totalSales,
      orderCount: item.orderCount,
      deliveryFees: item.deliveryFees,
    }));

    cache.put(cacheKey, result, 5 * 60 * 1000);
    res.status(200).json(result);
  } catch (err) {
    console.error("Sales analytics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// More efficient product performance query
const getProductPerformance = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";
    const cacheKey = `productPerformance_${restaurantId || "admin"}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const baseQuery = isAdmin ? {} : { restaurantId };
    const { startDate } = getDateRange("month"); // Last month data

    const topProducts = await Order.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: startDate } } },
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
          category: { $first: "$productDetails.categoryId" },
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

    // Add category names
    const categoryIds = [...new Set(topProducts.map((p) => p.category))];
    const categories = await Category.find({ _id: { $in: categoryIds } });
    const categoryMap = categories.reduce((map, cat) => {
      map[cat._id] = cat.name;
      return map;
    }, {});

    const result = topProducts.map((product) => ({
      id: product._id,
      name: product.name,
      category: categoryMap[product.category] || "Uncategorized",
      totalSold: product.totalSold,
      totalRevenue: product.totalRevenue,
    }));

    cache.put(cacheKey, result, 15 * 60 * 1000); // Cache for 15 minutes
    res.status(200).json(result);
  } catch (err) {
    console.error("Product performance error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// More efficient order status distribution
const getOrderStatusDistribution = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const isAdmin = req.user.role === "0";
    const cacheKey = `orderStatus_${restaurantId || "admin"}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const baseQuery = isAdmin ? {} : { restaurantId };
    const { startDate } = getDateRange("month"); // Last month data

    const statusDistribution = await Order.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: startDate } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result = statusDistribution.map((status) => ({
      status: status._id,
      count: status.count,
    }));

    cache.put(cacheKey, result, 15 * 60 * 1000);
    res.status(200).json(result);
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
