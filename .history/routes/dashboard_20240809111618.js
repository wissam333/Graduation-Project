//basic imports
const router = require("express").Router();
const {
  getUserStates,
  getMonthlyIncome,
  getLastMonthSales,
  getLastWeekSales,
  getDashboardStates,
  getSalesComparison,
  getSalesDataForProduct,
  getMonthlySalesDataForProduct
} = require("../controllers/dashboardController");
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");

//get orders count
router.get("/dashboardStates", verifyTokenAndAdmin, getDashboardStates);

// get user states
router.get("/states", verifyTokenAndAdmin, getUserStates);

// get monthly income
router.get("/income", verifyTokenAndAdmin, getMonthlyIncome);

router.get("/getLastMonthSales", verifyTokenAndAdmin, getLastMonthSales);

router.get("/getLastWeekSales", verifyTokenAndAdmin, getLastWeekSales);

router.get("/getSalesComparison", getSalesComparison);

router.get("/getSalesDataForProduct/:productId", verifyTokenAndAdmin, getSalesDataForProduct);

router.get("/getMonthlySalesDataForProduct/:productId", verifyTokenAndAdmin, getMonthlySalesDataForProduct);


module.exports = router;
