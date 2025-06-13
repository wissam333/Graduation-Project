const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true, // Every category belongs to a restaurant
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    img: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);
