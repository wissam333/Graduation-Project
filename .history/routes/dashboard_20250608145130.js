// basic imports
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

// Import your middleware
const {
  verifyTokenAndAdminOrManager, // For routes accessible by both admin and manager
  verifyTokenAndAdmin, // For admin-only routes
  verifyTokenAndManager, // For manager-only routes
} = require("../Middleware/verifyToken");

// Dashboard stats route - accessible by admin or manager
router.get("/stats", verifyTokenAndAdminOrManager, getDashboardStats);

// Sales analytics routes - accessible by admin or manager
router.get("/sales-analytics", verifyTokenAndAdminOrManager, getSalesAnalytics);

// Product performance route - accessible by admin or manager
router.get(
  "/product-performance",
  verifyTokenAndAdminOrManager,
  getProductPerformance
);

// Order status distribution route - accessible by admin or manager
router.get(
  "/order-status",
  verifyTokenAndAdminOrManager,
  getOrderStatusDistribution
);

// Customer analytics route - accessible by admin or manager
router.get(
  "/customer-analytics",
  verifyTokenAndAdminOrManager,
  getCustomerAnalytics
);

// Comparison metrics route - accessible by admin or manager
router.get("/comparison", verifyTokenAndAdminOrManager, getComparisonMetrics);

// Product analytics route - accessible by admin or manager
router.get(
  "/product-analytics/:productId",
  verifyTokenAndAdminOrManager,
  getProductAnalytics
);

module.exports = router;
