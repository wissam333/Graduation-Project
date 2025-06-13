//basic imports
const router = require("express").Router();
const {
  getDashboardStats,
  getSalesAnalytics,
  getProductPerformance,
  getOrderStatusDistribution,
  getCustomerAnalytics,
  getComparisonMetrics,
  getProductAnalytics,
} = require("../controllers/dashboardController");

module.exports = router;
