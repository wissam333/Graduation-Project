//basic imports
const router = require("express").Router();
const {
  register,
  login,
  registerManager,
  registerDriver,
} = require("../controllers/authController");

// register
router.post("/register", register);

// login
router.post("/login", login);

// register
router.post("/registerManager", registerManager);

// register
router.post("/registerDriver", registerDriver);

module.exports = router;
