const Product = require("../models/Product");
const Settings = require("../models/Settings");
const User = require("../models/User");
const Order = require("../models/Order");

// Helper to calculate distance between two geo points (in km)
// Haversine-based
const getDistanceInKm = (latLng1, latLng2) => {
  const toRad = (value) => (value * Math.PI) / 180;

  // Destructure [lat, lng] inputs and convert to [lng, lat] internally
  const [lat1, lon1] = latLng1;
  const [lat2, lon2] = latLng2;

  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Add Order
const addOrder = async (req, res) => {
  try {
    const { userId, name, email, products, address, location } = req.body; // userCoords = [lng, lat]

    let amount = 0;
    let deliveryPrice = 0;
    const enrichedProducts = [];
    const settings = await Settings.findOne();
    const pricePerKm = settings?.pricePerKm || 1.5; // default fallback

    for (const item of products) {
      const product = await Product.findById(item.productId).populate(
        "restaurantId"
      );
      if (!product || !product.restaurantId) {
        return res
          .status(404)
          .json({ message: "Product or restaurant not found" });
      }

      const price = product.price * item.quantity;
      amount += price;

      const distance = getDistanceInKm(location, product.restaurantId.location);

      deliveryPrice += distance * pricePerKm;

      enrichedProducts.push(item);
    }

    const newOrder = new Order({
      userId,
      name,
      email,
      products: enrichedProducts,
      amount: Math.round(amount + deliveryPrice),
      address,
      deliveryPrice: Math.round(deliveryPrice),
      location: location,
      status: "pending",
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, products, address, location, status } = req.body;

    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Initialize update object
    const updateData = {};

    // Only update name if provided
    if (name !== undefined) updateData.name = name;

    // Only update email if provided
    if (email !== undefined) updateData.email = email;

    // Only update address if provided
    if (address !== undefined) updateData.address = address;

    // Only update status if provided
    if (status !== undefined) updateData.status = status;

    // Only update location if provided and valid
    if (location !== undefined) {
      if (!Array.isArray(location) || location.length !== 2) {
        return res.status(400).json({ message: "Invalid user coordinates" });
      }
      updateData.location = location;
    }

    // Handle products update (if provided)
    if (products !== undefined) {
      if (!Array.isArray(products)) {
        return res.status(400).json({ message: "Products must be an array" });
      }

      let amount = 0;
      let deliveryPrice = 0;
      const enrichedProducts = [];

      for (const item of products) {
        if (!item.productId || !item.quantity) {
          return res
            .status(400)
            .json({ message: "Each product must have productId and quantity" });
        }

        const product = await Product.findById(item.productId).populate(
          "restaurantId"
        );
        if (!product || !product.restaurantId) {
          return res
            .status(404)
            .json({ message: "Product or restaurant not found" });
        }

        const price = product.price * item.quantity;
        amount += price;

        const distance = getDistanceInKm(
          updateData.location || existingOrder.location, // Use new location if provided, else existing
          product.restaurantId.location
        );
        const deliveryRatePerKm = 1.5;
        deliveryPrice += distance * deliveryRatePerKm;

        enrichedProducts.push(item);
      }

      updateData.products = enrichedProducts;
      updateData.amount = Math.round(amount + deliveryPrice);
      updateData.deliveryPrice = Math.round(deliveryPrice);
    }

    // Perform a single update operation
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Order
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the order exists
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Delete the order
    await Order.findByIdAndDelete(id);
    res.status(200).json({ message: "Order has been deleted!" });
  } catch (err) {
    res.status(500).json(err);
  }
};

// Get Order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the order details by ID
    const order = await Order.findById(id).populate("location");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Populate user, products, and restaurants (excluding managers)
    const [user, populatedProducts] = await Promise.all([
      User.findById(order.userId).select("-password -role"),
      Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.productId).populate({
            path: "restaurantId",
            select: "-managers", // Exclude managers field
            model: "Restaurant",
          });

          return {
            ...item.toObject(),
            product: product
              ? {
                  ...product.toObject(),
                  restaurant: product.restaurantId,
                }
              : null,
          };
        })
      ),
    ]);

    // Create the transformed order
    const transformedOrder = {
      ...order.toObject(),
      products: populatedProducts,
      user: user || null,
    };

    res.status(200).json(transformedOrder);
  } catch (err) {
    res.status(500).json(err);
  }
};

// Get All Orders (Filter by UserId or RestaurantId Optional)
const getAllOrders = async (req, res) => {
  try {
    const { userId, restaurantId } = req.query;

    // Build query based on provided parameters
    const query = {};
    if (userId) query.userId = userId;
    if (restaurantId) {
      // First find all products that belong to this restaurant
      const restaurantProducts = await Product.find({ restaurantId }).select(
        "_id"
      );
      const productIds = restaurantProducts.map((p) => p._id);

      // Then find orders that contain any of these products
      query["products.productId"] = { $in: productIds };
    }

    const orders = await Order.find(query).populate("location");

    // Populate users, products, and restaurants (excluding managers)
    const populatedOrders = await Promise.all(
      orders.map(async (order) => {
        const [user, populatedProducts] = await Promise.all([
          User.findById(order.userId).select("-password -role"),
          Promise.all(
            order.products.map(async (item) => {
              const product = await Product.findById(item.productId).populate({
                path: "restaurantId",
                select: "-managers", // Exclude managers field
                model: "Restaurant",
              });

              return {
                ...item.toObject(),
                product: product
                  ? {
                      ...product.toObject(),
                      restaurant: product.restaurantId,
                    }
                  : null,
              };
            })
          ),
        ]);

        return {
          ...order.toObject(),
          products: populatedProducts,
          user: user || null,
        };
      })
    );

    res.status(200).json(populatedOrders);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching orders",
      error: err.message,
    });
  }
};

module.exports = {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getAllOrders,
};
