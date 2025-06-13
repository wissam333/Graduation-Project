const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderThreshold: {
      type: Number,
      required: true,
      min: 0,
    },
    warehouse: {
      type: String,
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
