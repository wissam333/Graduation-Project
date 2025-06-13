const mongoose = require("mongoose");

const MainSliderSchema = new mongoose.Schema(
  {
    img: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MainSlider", MainSliderSchema);
