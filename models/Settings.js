const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    pricePerKm: {
      type: Number,
      required: true,
      default: 1.5, // fallback if not set
    },
    driverPercentage: {
      type: Number,
      required: true,
      default: 20, // fallback if not set
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Settings", SettingsSchema);
