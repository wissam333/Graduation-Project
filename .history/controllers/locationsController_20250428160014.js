const Location = require("../models/Location");

const createLocation = async (req, res) => {
  try {
    const { name, price } = req.body;

    // Check if location already exists
    const existingLocation = await Location.findOne({ name });
    if (existingLocation) {
      return res.status(400).json({ message: "Location already exists" });
    }

    // Create a new location
    const newLocation = new Location({
      name,
      price,
    });

    // Save the location to the database
    const savedLocation = await newLocation.save();

    res.status(201).json(savedLocation);
  } catch (err) {
    res.status(500).json(err);
  }
};

const updateLocation = async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;

  try {
    // Update location by id
    const updatedLocation = await Location.findByIdAndUpdate(
      id,
      { $set: { name, price } },
      { new: true }
    );

    if (!updatedLocation) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json(updatedLocation);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteLocation = async (req, res) => {
  const { id } = req.params;

  try {
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    await Location.findByIdAndDelete(id);
    res.status(200).json({ message: "Location has been deleted" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getLocation = async (req, res) => {
  const { id } = req.params;

  try {
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json(location);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getLocations = async (req, res) => {
  const { name } = req.query; // Optional query to filter by location name

  try {
    let query = {};
    if (name) {
      query.name = { $regex: name, $options: "i" }; // Case-insensitive search by name
    }

    const locations = await Location.find(query);

    res.status(200).json(locations);
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createLocation,
  updateLocation,
  deleteLocation,
  getLocation,
  getLocations,
};
