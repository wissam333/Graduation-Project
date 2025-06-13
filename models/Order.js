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
    amount: {
      type: Number,
      required: true,
      immutable: true, // can be set programmatically
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
      immutable: true, // can be set programmatically
    },
  },
  { timestamps: true }
);

// Create a 2dsphere index on the location field to support geospatial queries
OrderSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Order", OrderSchema);
