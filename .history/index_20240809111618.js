// basics
const express = require("express");
const mongoose = require("mongoose");
const app = express();
app.use(express.json());
const path = require("path");
const cors = require("cors");
const port = process.env.PORT || 5000;

// importing routes
const userRoute = require("./routes/user");
const authRoute = require("./routes/auth");
const productRoute = require("./routes/product");
const cartRoute = require("./routes/cart");
const orderRoute = require("./routes/order");
const favoriteRoute = require("./routes/favorite");
const dashboard = require("./routes/dashboard");
const recommendations = require("./routes/recommendations");
const inventory = require("./routes/inventory");

mongoose
  .connect("mongodb://0.0.0.0:27017/ecommerce", {})
  .then((result) => {
    console.log("connected to database!!");
  })
  .catch((error) => {
    console.log("Connection failed!!", error);
  });

// Allow requests from all origins and include 'token' header
app.use(
  cors({
    origin: "*", // Allow requests from all origins
    allowedHeaders: ["Content-Type", "Authorization", "token"],
  })
);
// static images
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploads directory statically
// use routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/products", productRoute);
app.use("/api/cart", cartRoute);
app.use("/api/orders", orderRoute);
app.use("/api/favorite", favoriteRoute);
app.use("/api/dashboard", dashboard);
app.use("/api/recommendations", recommendations);
app.use("/api/inventory", inventory);

// start server
app.listen(port, () => {
  console.log("server is runing on port 5000");
});
