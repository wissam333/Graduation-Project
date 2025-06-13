//basic imports
const router = require("express").Router();
const {
  register,
  login,
  registerManager,
} = require("../controllers/authController");

// register
router.post("/register", register);

// login
router.post("/login", login);

// register
router.post("/register", registerManager);

module.exports = router;
