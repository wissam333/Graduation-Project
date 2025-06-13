const router = require("express").Router();
const {
  getSettings,
  updateSettings,
} = require("../controllers/settingsController");

router.get("/", getSettings);
router.put("/", updateSettings);

module.exports = router;
