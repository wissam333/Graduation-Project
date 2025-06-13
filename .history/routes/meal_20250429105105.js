//basics
const router = require("express").Router();
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");
const {
  createMeal,
  updateMeal,
  deleteMeal,
  getMeal,
  getMeals,
} = require("../controllers/mealController");
const uploadImg = require("../Middleware/multerMiddleware");

// create Meal
router.post("/", uploadImg, createMeal);

// update Meal
router.put("/:id", uploadImg, updateMeal);

// delete Meal
router.delete("/:id", deleteMeal);

// get Meal
router.get("/:id", getMeal);

// get Meals
router.get("/", getMeals);

module.exports = router;
