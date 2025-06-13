//basics
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
} = require("../controllers/orderController");

// Add Order
router.post("/", addOrder);

// Update Order
router.put("/:id", updateOrder);

// Delete Order
router.delete("/:id", deleteOrder);

// Get Order by ID
router.get("/:id", getOrderById);

// Get All Orders (Optional: filter by userId)
router.get("/", getAllOrders);

// Add this new route
router.get("/:id/invoice", generateInvoice);

// Change Order status

module.exports = router;
