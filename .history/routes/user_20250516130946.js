//basics
const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
} = require("../Middleware/verifyToken");
const {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
} = require("../controllers/userController");

// update user
router.put("/:id", updateUser);

// delete user
router.delete("/:id", deleteUser);

// get user
router.get("/:id", getUser);

// get users
router.get("/", getUsers);

module.exports = router;
