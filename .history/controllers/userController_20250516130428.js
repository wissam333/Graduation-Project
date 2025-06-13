// basic imports
const CryptoJS = require("crypto-js");
const User = require("../models/User");

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const requestingUser = req.user; // From auth middleware

    // Find the user to be updated with their current role
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Authorization check
    if (requestingUser.role !== "0" && requestingUser._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile",
      });
    }

    // Handle password update
    if (updates.password) {
      updates.password = CryptoJS.AES.encrypt(
        updates.password,
        process.env.PASS_SEC
      ).toString();
    }

    // Handle restaurant assignment changes
    if (updates.managedRestaurants) {
      // Only admin can change restaurant assignments
      if (requestingUser.role !== "0") {
        return res.status(403).json({
          success: false,
          message: "Only admin can change restaurant assignments",
        });
      }

      // Managers can only manage one restaurant
      if (updates.managedRestaurants.length > 1) {
        return res.status(400).json({
          success: false,
          message: "A manager can only be assigned to one restaurant",
        });
      }

      const [newRestaurantId] = updates.managedRestaurants;
      const oldRestaurantId = userToUpdate.managedRestaurants[0];

      // Check if restaurant exists
      const restaurantExists = await Restaurant.exists({
        _id: newRestaurantId,
      });
      if (!restaurantExists) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found",
        });
      }

      // Remove user from old restaurant's managers if changing assignment
      if (oldRestaurantId && oldRestaurantId.toString() !== newRestaurantId) {
        await Restaurant.findByIdAndUpdate(oldRestaurantId, {
          $pull: { managers: id },
        });
      }

      // Add user to new restaurant's managers
      await Restaurant.findByIdAndUpdate(newRestaurantId, {
        $addToSet: { managers: id },
      });

      // Ensure the user has manager role if being assigned to a restaurant
      if (userToUpdate.role !== "2") {
        updates.role = "2";
      }
    }

    // Update user data
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
        select: "-password",
      }
    );

    // If user was a manager and is being changed to non-manager, clean up
    if (
      (userToUpdate.role === "2" && updates.role && updates.role !== "2") ||
      (updates.managedRestaurants && updates.managedRestaurants.length === 0)
    ) {
      const [oldRestaurantId] = userToUpdate.managedRestaurants;
      if (oldRestaurantId) {
        await Restaurant.findByIdAndUpdate(oldRestaurantId, {
          $pull: { managers: id },
        });
      }
      // Ensure managedRestaurants is empty if role changed from manager
      updatedUser.managedRestaurants = [];
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: err.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    // Validate if user exists
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete user by ID
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User has been deleted!" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user", error: err });
  }
};

const getUser = async (req, res) => {
  try {
    // Validate if the user exists by ID
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Exclude the password from the response
    const { password, ...others } = user._doc;
    res.status(200).json(others);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user", error: err });
  }
};

const getUsers = async (req, res) => {
  const query = req.query.new; // Check if we need to get the last user added
  try {
    // If `new` query is true, fetch the most recent user
    const users = query
      ? await User.find().sort({ _id: -1 }).limit(1)
      : await User.find(); // Fetch all users otherwise

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users", error: err });
  }
};

module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
};
