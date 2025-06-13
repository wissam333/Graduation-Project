// basic imports
const CryptoJS = require("crypto-js");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const requestingUser = req.user;

    // Find the user to be updated
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
    if (updates.restaurantId !== undefined) {
      // Only admin can change restaurant assignments
      if (requestingUser.role !== "0") {
        return res.status(403).json({
          success: false,
          message: "Only admin can change restaurant assignments",
        });
      }

      // Clear restaurant assignment if null/empty is passed
      if (!updates.restaurantId) {
        // Remove from old restaurant if exists
        if (userToUpdate.restaurantId) {
          await Restaurant.findByIdAndUpdate(userToUpdate.restaurantId, {
            $pull: { managers: id },
          });
        }
        updates.role = "1"; // Demote to regular user
      } else {
        // Check if restaurant exists
        const restaurantExists = await Restaurant.exists({
          _id: updates.restaurantId,
        });
        if (!restaurantExists) {
          return res.status(404).json({
            success: false,
            message: "Restaurant not found",
          });
        }

        // Remove from old restaurant if changing assignment
        if (
          userToUpdate.restaurantId &&
          !userToUpdate.restaurantId.equals(updates.restaurantId)
        ) {
          await Restaurant.findByIdAndUpdate(userToUpdate.restaurantId, {
            $pull: { managers: id },
          });
        }

        // Add to new restaurant
        await Restaurant.findByIdAndUpdate(updates.restaurantId, {
          $addToSet: { managers: id },
        });

        // Ensure user has manager role
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
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // If user is a manager, populate restaurant details
    if (user.role === "2" && user.restaurantId) {
      const restaurant = await Restaurant.findById(user.restaurantId);
      const userWithRestaurant = {
        ...user._doc,
        restaurant: restaurant || null,
      };
      return res.status(200).json(userWithRestaurant);
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user", error: err });
  }
};

const getUsers = async (req, res) => {
  const query = req.query.new; // Check if we need to get the last user added
  try {
    let users;

    // If `new` query is true, fetch the most recent user
    if (query) {
      users = await User.find().sort({ _id: -1 }).limit(1).select("-password");
    } else {
      // Fetch all users otherwise
      users = await User.find().select("-password");
    }

    // For managers, populate their restaurant information
    const usersWithRestaurants = await Promise.all(
      users.map(async (user) => {
        if (user.role === "2" && user.restaurantId) {
          const restaurant = await Restaurant.findById(user.restaurantId);
          return {
            ...user._doc,
            restaurant: restaurant || null,
          };
        }
        return user;
      })
    );

    res.status(200).json(usersWithRestaurants);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users", error: err });
  }
};

const getUsersTemp = async (req, res) => {
  try {
    // Only fetch username and _id, exclude everything else
    const users = await User.find({}, { username: 1, _id: 1 }).lean();

    res.status(200).json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: err.message });
  }
};

module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  getUsersTemp,
};
