//basic imports
const router = require("express").Router();
const {
  productRecommendations,
  userRecommendations,
  categoryRecommendations,
} = require("../controllers/recommendationsController");

// content-based recommendations system
router.get("/products/:productId", productRecommendations);

// collaborative recommendations system
router.get("/users/:userId", userRecommendations);

// collaborative recommendations system
router.get("/category/:categorId", categoryRecommendations);
module.exports = router;
