const Settings = require("../models/Settings");

// Get current delivery price per km
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.status(200).json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update delivery price per km
const updateSettings = async (req, res) => {
  try {
    const { pricePerKm } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ pricePerKm });
    } else {
      settings.pricePerKm = pricePerKm;
    }

    const saved = await settings.save();
    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
