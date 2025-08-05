const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
} = require("../Middleware/verifyToken");

const {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getAllOrders,
  generateInvoice,
  assignDriverToOrder,
  getDriverDues,
  updateDriverDuesStatus,
  suggestOrderGroupings,
  assignDriverToGroup,
} = require("../controllers/orderController");

// Add Order
router.post("/", addOrder);

// Update Order
router.put("/:id", updateOrder);

// Delete Order
router.delete("/:id", deleteOrder);

// Get Driver Dues - MOVED ABOVE PARAMETERIZED ROUTES
router.get("/getDriverDues", getDriverDues);

// generate Invoice
router.get("/:id/invoice", generateInvoice);

// suggest Order Groupings
router.get("/suggestOrderGroupings", suggestOrderGroupings);

// assign Driver To Group
router.post("/assignDriverToGroup", assignDriverToGroup);

// Get All Orders (Optional: filter by userId)
router.get("/", getAllOrders);

// Get Order by ID - this comes last
router.get("/:id", getOrderById);

// assign Driver To Order
router.post("/assignDriverToOrder", assignDriverToOrder);

// update Driver Dues Status
router.put("/updateDriverDuesStatus/:id", updateDriverDuesStatus);

module.exports = router;
