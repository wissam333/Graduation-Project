const Favorite = require("../models/Favorite");
const User = require("../models/User");
const Product = require("../models/Product");

const likeOrDislikeProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id; // retrieve userId from authenticated user

    // Check if the user and product exist
    const user = await User.findById(userId);
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the user's favorite or create a new one if it doesn't exist
    let userFavorite = await Favorite.findOne({ userId });
    if (!userFavorite) {
      userFavorite = new Favorite({
        userId: userId,
        productsId: [productId],
      });
    } else {
      // Check if the user has already liked the product
      const index = userFavorite.productsId.indexOf(productId);
      if (index !== -1) {
        // If the product is already liked, remove it from the productsId array (dislike)
        userFavorite.productsId.splice(index, 1);
      } else {
        // If the product is not liked yet, add it to the productsId array (like)
        userFavorite.productsId.push(productId);
      }
    }

    await userFavorite.save();
    if (userFavorite.productsId.includes(productId)) {
      return res.json({ message: `Product ${productId} liked successfully` });
    } else {
      return res.json({
        message: `Product ${productId} disliked successfully`,
      });
    }
  } catch (error) {
    console.error("Error liking/disliking product:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  likeOrDislikeProduct,
};
