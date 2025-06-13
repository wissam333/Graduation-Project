//basics
const router = require("express").Router();
const { verifyTokenAndAdmin } = require("../Middleware/verifyToken");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getProducts,
  getProductsTemp,
} = require("../controllers/productController");
const uploadImg = require("../Middleware/multerMiddleware");

// create product
router.post("/", uploadImg, createProduct);

// update Product
router.put("/:id", uploadImg, updateProduct);

// delete Product
router.delete("/:id", deleteProduct);

// get Product
router.get("/find/:id", getProduct);

// get Products
router.get("/", getProducts);

// get Products
router.get("/getProductsTemp", getProductsTemp);

module.exports = router;
