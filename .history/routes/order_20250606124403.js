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
  updateOrderStatus,
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

// Change Order status
router.patch("/:id/status", updateOrderStatus);

module.exports = router;
