const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    location: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  { timestamps: true }
);

RestaurantSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Restaurant", RestaurantSchema);
