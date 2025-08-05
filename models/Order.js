const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    products: [
      {
        _id: false,
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          required: true,
        },
      },
    ],
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      immutable: true,
    },
    address: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "Pending",
    },
    location: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    deliveryPrice: {
      type: Number,
      required: true,
      immutable: true,
    },
    orderGroupCode: {
      type: String,
      required: true,
      index: true, // Add index for faster queries
      default: null,
    },
    isGroupedOrder: {
      type: Boolean,
      default: false,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required: false,
    },
  },
  { timestamps: true }
);

OrderSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Order", OrderSchema);
