//basic imports
const router = require("express").Router();
const { likeOrDislikeProduct } = require("../controllers/favoriteController");
const { verifyToken } = require("../Middleware/verifyToken");

// like/dislike
//
router.post("/like/:productId", verifyToken, likeOrDislikeProduct);

module.exports = router;
