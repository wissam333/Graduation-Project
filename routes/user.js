//basics
const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
  verifyTokenAndAdminOrManager,
} = require("../Middleware/verifyToken");
const {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  getUsersTemp,
} = require("../controllers/userController");

// update user
router.put("/:id", verifyTokenAndAdminOrManager, updateUser);

// delete user
router.delete("/:id", deleteUser);

// get users temp
router.get("/temp", getUsersTemp);

// get user
router.get("/:id", getUser);

// get users
router.get("/", getUsers);

module.exports = router;
