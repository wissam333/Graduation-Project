//basics
const router = require("express").Router();
const {
  verifyTokenAndAdmin,
  verifyTokenAndAuth,
  verifyTokenAndManager,
} = require("../Middleware/verifyToken");
const {
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  getUsersTemp,
} = require("../controllers/userController");

// update user
router.put("/:id", verifyTokenAndAuth, updateUser);

// delete user
router.delete("/:id", deleteUser);

// get user
router.get("/:id", getUser);

// get users
router.get("/", getUsers);

// get users temp
router.get("/temp", getUsersTemp);

module.exports = router;
