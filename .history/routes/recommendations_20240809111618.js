//basic imports
const router = require("express").Router();
const {
  productRecommendations,
  userRecommendations,
} = require("../controllers/recommendationsController");

// content-based recommendations system
router.get("/products/:productId", productRecommendations);

// collaborative recommendations system
router.get("/users/:userId", userRecommendations);

module.exports = router;
