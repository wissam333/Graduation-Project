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
    const { name, email, products, address, location } = req.body;

    // Validate input
    if (!Array.isArray(location) || location.length !== 2) {
      return res.status(400).json({ message: "Invalid user coordinates" });
    }

    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    let amount = 0;
    let deliveryPrice = 0;
    const enrichedProducts = [];

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
      const deliveryRatePerKm = 1.5;
      deliveryPrice += distance * deliveryRatePerKm;

      enrichedProducts.push(item);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          email,
          products: enrichedProducts,
          amount: Math.round(amount + deliveryPrice),
          address,
          location: location,
          deliveryPrice: Math.round(deliveryPrice),
          status: "pending",
        },
      },
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

    // Populate user and products separately since they're stored as strings
    const [user, populatedProducts] = await Promise.all([
      User.findById(order.userId),
      Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.productId);
          return {
            ...item.toObject(),
            product: product || null,
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

// Get All Orders (Filter by UserId Optional)
const getAllOrders = async (req, res) => {
  try {
    const { userId } = req.query;

    // If a userId is provided, filter by that userId
    const query = userId ? { userId } : {};

    const orders = await Order.find(query).populate("location");

    // Populate users and products for all orders
    const populatedOrders = await Promise.all(
      orders.map(async (order) => {
        const [user, populatedProducts] = await Promise.all([
          User.findById(order.userId),
          Promise.all(
            order.products.map(async (item) => {
              const product = await Product.findById(item.productId);
              return {
                ...item.toObject(),
                product: product || null,
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
    res.status(500).json(err);
  }
};

module.exports = {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getAllOrders,
};
