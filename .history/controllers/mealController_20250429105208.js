// basic imports
const Meal = require("../models/Meal");
const LFUCache = require("../cache/cache");
const MealCache = new LFUCache(100);
const cache = require("memory-cache");

// Helper function to invalidate cache for a specific Meal ID
const invalidateCache = (MealId) => {
  MealCache.remove(MealId);
};

const createMeal = async (req, res) => {
  try {
    // Validation: Check if a Meal with the same title already exists
    const Meal = await Meal.findOne({ title: req.body.title });

    // Ensure the image file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Get the image file name from req.file
    const imgName = req.file.originalname; // Use the original file name or generate a unique one
    const imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`; // Construct the complete URL for the image

    // Create a new Meal object
    const newMeal = new Meal({
      title: req.body.title,
      desc: req.body.desc,
      img: imgUrl,
      categoryId: req.body.categoryId,
      price: req.body.price,
      restaurantId: req.body.restaurantId,
    });

    // Check if the Meal already exists
    if (Meal) {
      return res
        .status(403)
        .json({ message: "This Meal is already submitted" });
    }

    // Save the Meal to the database
    const savedMeal = await newMeal.save();

    // Invalidate cache (if you use caching)
    cache.clear();

    // Return the created Meal
    res.status(201).json(savedMeal);
  } catch (err) {
    res.status(500).json(err);
  }
};

const updateMeal = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the Meal exists
    const Meal = await Meal.findById(id);
    if (!Meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    // Update the image if a new one is provided
    let imgUrl = Meal.img; // Retain existing image if not updated
    if (req.file) {
      const imgName = req.file.originalname;
      imgUrl = `${req.protocol}://${req.get("host")}/uploads/${imgName}`;
    }

    // Update the Meal with new details
    const updatedMeal = await Meal.findByIdAndUpdate(
      id,
      {
        $set: {
          title: req.body.title,
          desc: req.body.desc,
          img: imgUrl,
          categoryId: req.body.categoryId,
          price: req.body.price,
          restaurantId: req.body.restaurantId,
        },
      },
      { new: true }
    );

    if (!updatedMeal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    // Invalidate cache for updated Meal
    invalidateCache(id);
    cache.clear();

    res.status(200).json(updatedMeal);
  } catch (err) {
    res.status(500).json(err);
  }
};

const deleteMeal = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the Meal exists
    const Meal = await Meal.findById(id);
    if (!Meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    // Delete the Meal
    await Meal.findByIdAndDelete(id);

    // Invalidate cache for the deleted Meal
    invalidateCache(id);
    cache.clear();

    res.status(200).json({ message: "Meal has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

const getMeal = async (req, res) => {
  try {
    const MealId = req.params.id;

    // Check if Meal is cached
    const cachedMeal = MealCache.get(MealId);
    if (cachedMeal) {
      return res.status(200).json(cachedMeal);
    }

    // Fetch the Meal from the database
    const oneMeal = await Meal.findById(MealId);
    if (!oneMeal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    // Cache the fetched Meal
    const MealData = oneMeal.toObject();
    MealCache.put(MealId, MealData);

    res.status(200).json(MealData);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getMeals = async (req, res) => {
  try {
    const qCategory = req.query.categoryId; // Get the categoryId from query parameters (optional)
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // Default to 10 items per page if not provided
    const latest = req.query.latest; // Check if latest is set

    const skip = (page - 1) * pageSize; // Calculate number of items to skip

    const cacheKey = JSON.stringify(
      "Meals" + qCategory + page + pageSize + latest
    );
    const cachedMeals = cache.get(cacheKey);

    if (cachedMeals) {
      return res.status(200).json(cachedMeals);
    }

    // Define the query object for filtering Meals
    let query = {};
    if (qCategory) {
      query = {
        categoryId: qCategory, // Filter by categoryId if provided
      };
    }

    // Build the Meal query
    let MealsQuery = Meal.find(query);

    if (latest) {
      MealsQuery = MealsQuery.sort({ createdAt: -1 }).limit(5); // Get the latest 5 Meals
    } else {
      MealsQuery = MealsQuery.skip(skip).limit(pageSize); // Apply pagination
    }

    const Meals = await MealsQuery;

    const MealsCount = latest ? 5 : await Meal.countDocuments(query); // Count total Meals matching the query
    const totalPages = latest ? 1 : Math.ceil(MealsCount / pageSize); // If latest, only 1 page

    // Store in cache
    cache.put(cacheKey, {
      Meals: Meals,
      totalPages,
      MealsCount,
    });

    // Respond with the Meals
    res.status(200).json({ Meals: Meals, totalPages, MealsCount });
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = {
  createMeal,
  updateMeal,
  deleteMeal,
  getMeal,
  getMeals,
};
