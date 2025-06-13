const mongoose = require("mongoose");

const SocialMediaSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SocialMedia", SocialMediaSchema);
