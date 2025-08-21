const Product = require("../models/Product");
const Settings = require("../models/Settings");
const User = require("../models/User");
const Order = require("../models/Order");
const DriverDues = require("../models/DriverDues");
const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");

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

// Helper function to generate order group code
function generateOrderGroupCode() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `GRP-${timestamp}-${random}`.toUpperCase();
}

// Add Order
const addOrder = async (req, res) => {
  try {
    const { userId, name, email, products, address, location } = req.body;
    const settings = await Settings.findOne();
    const pricePerKm = settings?.pricePerKm || 1.5;

    // Generate a unique order group code
    const orderGroupCode = generateOrderGroupCode(); // You'll need to implement this function

    // Group products by restaurant
    const productsByRestaurant = {};

    for (const item of products) {
      const product = await Product.findById(item.productId).populate(
        "restaurantId"
      );
      if (!product || !product.restaurantId) {
        return res
          .status(404)
          .json({ message: "Product or restaurant not found" });
      }

      const restaurantId = product.restaurantId._id.toString();
      if (!productsByRestaurant[restaurantId]) {
        productsByRestaurant[restaurantId] = {
          products: [],
          amount: 0,
          deliveryPrice: 0,
          restaurantLocation: product.restaurantId.location,
        };
      }

      const price = product.price * item.quantity;
      productsByRestaurant[restaurantId].products.push(item);
      productsByRestaurant[restaurantId].amount += price;
    }

    // Calculate delivery price for each restaurant
    for (const restaurantId in productsByRestaurant) {
      const restaurantData = productsByRestaurant[restaurantId];
      const distance = getDistanceInKm(
        location,
        restaurantData.restaurantLocation
      );
      restaurantData.deliveryPrice = distance * pricePerKm;
      restaurantData.totalAmount = Math.round(
        restaurantData.amount + restaurantData.deliveryPrice
      );
    }

    // Create orders for each restaurant
    const orders = [];
    const restaurantCount = Object.keys(productsByRestaurant).length;

    for (const restaurantId in productsByRestaurant) {
      const restaurantData = productsByRestaurant[restaurantId];

      const newOrder = new Order({
        userId,
        name,
        email,
        products: restaurantData.products,
        restaurantId,
        amount: restaurantData.totalAmount,
        address,
        deliveryPrice: Math.round(restaurantData.deliveryPrice),
        location: location,
        status: "Pending",
        orderGroupCode,
        isGroupedOrder: restaurantCount > 1, // Mark as grouped if there are multiple restaurants
      });

      const savedOrder = await newOrder.save();
      orders.push(savedOrder);
    }

    res.status(201).json({
      success: true,
      orderGroupCode,
      orders,
      isGrouped: restaurantCount > 1,
    });
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

    // Get the order details by ID and populate both location and driver
    const order = await Order.findById(id)
      .populate("location")
      .populate("driverId", "-password -role"); // Assuming driver is a User model

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
      // driver will be automatically included from the initial populate
    };

    res.status(200).json(transformedOrder);
  } catch (err) {
    res.status(500).json(err);
  }
};

// Get All Orders (Filter by UserId, RestaurantId, Status, Search with Server-side Pagination)
const getAllOrders = async (req, res) => {
  try {
    const {
      userId,
      restaurantId,
      status,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build the base query
    const query = {};

    // Add filters if provided
    if (userId) query.userId = userId;
    if (status) query.status = status;

    // Handle restaurant filter
    if (restaurantId) {
      const productIds = await Product.find({ restaurantId }).distinct("_id");
      query["products.productId"] = { $in: productIds };
    }

    // Handle search
    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).distinct("_id");

      query.userId = { $in: matchingUsers };
    }

    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate pagination
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    const totalPages = Math.ceil(total / limitInt);

    // Find orders with pagination
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitInt)
      .lean();

    // Get all unique user and product IDs
    const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];
    const allProductIds = orders.flatMap((o) =>
      o.products.map((p) => p.productId).filter(Boolean)
    );
    const productIds = [...new Set(allProductIds)];

    // Fetch related data
    const [users, products] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select("-password -role")
        .lean(),
      Product.find({ _id: { $in: productIds } })
        .populate({ path: "restaurantId", select: "-managers" })
        .lean(),
    ]);

    // Create lookup maps
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Build response with proper null checks
    const populatedOrders = orders.map((order) => {
      const populatedProducts = order.products.map((item) => {
        if (!item.productId) {
          return {
            ...item,
            product: null,
          };
        }

        const product = productMap.get(item.productId.toString());
        return {
          ...item,
          product: product
            ? {
                ...product,
                restaurant: product.restaurantId,
              }
            : null,
        };
      });

      return {
        ...order,
        products: populatedProducts,
        user: order.userId
          ? userMap.get(order.userId.toString()) || null
          : null,
      };
    });

    res.status(200).json({
      success: true,
      data: populatedOrders,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        totalPages,
        hasNextPage: pageInt < totalPages,
        hasPrevPage: pageInt > 1,
      },
    });
  } catch (err) {
    console.error("Error in getAllOrders:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: err.message,
    });
  }
};

const PDFDocument = require("pdfkit");
const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate location coordinates
    let deliveryAddress = order.address;

    // Fetch user and products in parallel
    const [user, populatedProducts] = await Promise.all([
      User.findById(order.userId).select("-password -role").lean(),
      Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.productId)
            .populate({
              path: "restaurantId",
              select: "-managers",
              model: "Restaurant",
            })
            .populate("categoryId")
            .lean();

          return {
            ...item.toObject(),
            product: product
              ? {
                  ...product,
                  restaurant: product.restaurantId,
                  category: product.categoryId,
                }
              : null,
          };
        })
      ),
    ]);

    // Format date
    const formattedDate = order.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Helper function to detect Arabic text
    const isArabic = (text) => {
      if (!text) return false;
      // Regular expression to match Arabic characters
      const arabicRegex = /[\u0600-\u06FF]/;
      return arabicRegex.test(text);
    };

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: `INV-${order._id.toString().slice(-6).toUpperCase()}`,
      date: formattedDate,
      orderId: order._id,
      customer: {
        name: order.name || "Not provided",
        email: order.email || "Not provided",
        address: deliveryAddress || "Not provided",
      },
      items: populatedProducts.map((item) => ({
        name: item.product?.title || "Unknown Product",
        description: item.product?.desc || "",
        quantity: item.quantity || 0,
        unitPrice: item.product?.price || 0,
        total: (item.product?.price || 0) * (item.quantity || 0),
        restaurant: item.product?.restaurant?.name || "Unknown Restaurant",
        category: item.product?.category?.name || "Unknown Category",
        isArabic: isArabic(item.product?.title), // Add flag for Arabic items
      })),
      subtotal: order.amount - (order.deliveryPrice || 0),
      deliveryFee: order.deliveryPrice || 0,
      total: order.amount || 0,
      status: order.status || "Unknown",
      paymentMethod: order.paymentMethod || "Credit Card",
      deliveryInstructions: order.deliveryInstructions || "Leave at door",
    };

    // Generate PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    // Register Arabic font
    // You'll need to provide a path to a font file that supports Arabic (like Arial Unicode MS or similar)
    doc.registerFont("Arabic", "uploads/The-Sans-Plain-alinma.ttf");

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice-${invoiceData.invoiceNumber}.pdf`
    );

    doc.pipe(res);

    // Add logo and header
    doc
      .image("uploads/logo.png", 50, 45, { width: 50 })
      .fillColor("#444444")
      .fontSize(20)
      .text("INVOICE", 100, 65, { align: "left" })
      .fontSize(10)
      .text(`Invoice #: ${invoiceData.invoiceNumber}`, 400, 50, {
        align: "right",
      })
      .text(`Date: ${invoiceData.date}`, 400, 65, { align: "right" })
      .moveDown();

    // Draw horizontal line
    doc.moveTo(50, 90).lineTo(550, 90).stroke();

    // Customer information
    doc
      .fontSize(12)
      .font("Arabic")
      .text(`Name: ${invoiceData.customer.name}`, 50, 125)
      .font("Arabic")
      .text(`Address: ${invoiceData.customer.address}`, 50, 140)
      .text(`Email: ${invoiceData.customer.email}`, 50, 155);

    // Items table
    doc.moveTo(50, 200).lineTo(550, 200).stroke();

    // Table header (always in English)
    doc
      .font("Arabic")
      .fillColor("#444444")
      .text("Item", 50, 210)
      .text("Category", 200, 210)
      .text("Restaurant", 300, 210)
      .text("Qty", 400, 210, { width: 50, align: "right" })
      .text("Price", 450, 210, { width: 50, align: "right" })
      .text("Total", 500, 210, { width: 50, align: "right" });

    doc.moveTo(50, 230).lineTo(550, 230).stroke();

    // Table rows
    let y = 240;
    invoiceData.items.forEach((item) => {
      // Switch to Arabic font if needed
      if (item.isArabic) {
        doc.font("Arabic");
      } else {
        doc.font("Arabic");
      }

      doc
        .fillColor("#444444")
        .text(item.name.substring(0, 30), 50, y, {
          width: 150,
          features: item.isArabic ? ["rtla"] : [], // Enable right-to-left for Arabic
        })
        .font("Arabic") // Categories and restaurants are probably in English
        .text(item.category.substring(0, 20), 200, y, { width: 100 })
        .text(item.restaurant.substring(0, 20), 300, y, { width: 100 })
        .text(item.quantity.toString(), 400, y, { width: 50, align: "right" })
        .text(`$${item.unitPrice.toFixed(2)}`, 450, y, {
          width: 50,
          align: "right",
        })
        .text(`$${item.total.toFixed(2)}`, 500, y, {
          width: 50,
          align: "right",
        });

      y += 30;
    });

    // Summary section (always in English)
    doc.moveTo(50, y).lineTo(550, y).stroke();

    doc
      .font("Arabic")
      .text("Subtotal:", 400, y + 20)
      .text(`$${invoiceData.subtotal.toFixed(2)}`, 500, y + 20, {
        width: 50,
        align: "right",
      });

    doc
      .text("Delivery Fee:", 400, y + 40)
      .text(`$${invoiceData.deliveryFee.toFixed(2)}`, 500, y + 40, {
        width: 50,
        align: "right",
      });

    doc
      .moveTo(400, y + 60)
      .lineTo(550, y + 60)
      .stroke();

    doc
      .font("Arabic")
      .text("Total:", 400, y + 70)
      .text(`$${invoiceData.total.toFixed(2)}`, 500, y + 70, {
        width: 50,
        align: "right",
      });

    // Footer
    doc
      .fontSize(10)
      .text("Thank you for your business!", 50, y + 120, { align: "center" })
      .text(
        "If you have any questions about this invoice, please contact support.",
        50,
        y + 140,
        { align: "center" }
      );

    doc.end();
  } catch (err) {
    console.error("Error generating invoice:", err);
    res.status(500).json({
      error: "Failed to generate invoice",
      details: err.message,
    });
  }
};

// Assign Driver to Order
const assignDriverToOrder = async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    // Validate input
    if (!orderId || !driverId) {
      return res
        .status(400)
        .json({ message: "Order ID and Driver ID are required" });
    }

    // Check if driver exists and has role 3
    const driver = await User.findById(driverId);
    if (!driver || driver.role != 3) {
      return res
        .status(400)
        .json({ message: "Invalid driver ID or user is not a driver" });
    }

    // Check if order exists and is in Processing status
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== "Processing") {
      return res.status(400).json({
        message: `Cannot assign driver to order with status: ${order.status}`,
      });
    }

    // Get driver percentage from settings
    const settings = await Settings.findOne();
    const driverPercentage = settings?.driverPercentage || 20;

    // Calculate driver dues amount (20% of order amount)
    const driverAmount = (order.deliveryPrice * driverPercentage) / 100;

    // Update order status and assign driver
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: "Shipping",
          driverId: driverId,
        },
      },
      { new: true }
    );

    // Create driver dues record
    const driverDues = new DriverDues({
      driverId,
      amount: driverAmount,
      orderId,
      status: "Pending",
    });

    await driverDues.save();

    res.status(200).json({
      success: true,
      message: "Driver assigned successfully",
      order: updatedOrder,
      driverDues,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const getDriverDues = async (req, res) => {
  try {
    const { driverId, status, orderId, restaurantId } = req.query;

    // Create filter object
    const filter = {};

    // Validate and add driverId to filter if provided
    if (driverId) {
      if (!mongoose.Types.ObjectId.isValid(driverId)) {
        return res.status(400).json({ message: "Invalid driver ID format" });
      }
      filter.driverId = driverId;
    }

    // Add status to filter if provided
    if (status) {
      filter.status = status;
    }

    // Validate and add orderId to filter if provided
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ message: "Invalid order ID format" });
      }
      filter.orderId = orderId;
    }

    // If restaurantId is provided, we need to find drivers belonging to that restaurant first
    let driverFilter = {};
    if (restaurantId) {
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res
          .status(400)
          .json({ message: "Invalid restaurant ID format" });
      }
      driverFilter.restaurantId = restaurantId;
    }

    // Find drivers that match the restaurant filter (if any)
    const matchingDrivers = restaurantId
      ? await User.find(driverFilter).select("_id")
      : null;

    // If restaurant filter was provided, add matching driver IDs to the dues filter
    if (restaurantId && matchingDrivers) {
      filter.driverId = { $in: matchingDrivers.map((d) => d._id) };
    }

    // Find dues with optional filters and populate related data
    const dues = await DriverDues.find(filter)
      .populate({
        path: "driverId",
        select: "username email role restaurantId",
        model: "User",
      })
      .populate({
        path: "orderId",
        select:
          "name email amount deliveryPrice status address location createdAt",
        model: "Order",
        populate: [
          {
            path: "products.productId",
            select: "title price",
            model: "Product",
          },
        ],
      })
      .sort({ createdAt: -1 }); // Newest first

    // Get restaurant information for drivers
    const duesWithRestaurants = await Promise.all(
      dues.map(async (due) => {
        let restaurant = null;

        // If driver has a restaurantId, populate it
        if (due.driverId?.restaurantId) {
          const restaurantDoc = await mongoose
            .model("Restaurant")
            .findById(due.driverId.restaurantId)
            .select("name");
          restaurant = restaurantDoc
            ? {
                _id: restaurantDoc._id,
                name: restaurantDoc.name,
              }
            : null;
        }

        return {
          ...due.toObject(),
          restaurantInfo: restaurant,
        };
      })
    );

    // Transform the data for consistent response
    const transformedDues = duesWithRestaurants.map((due) => {
      const driver = due.driverId
        ? {
            _id: due.driverId._id,
            username: due.driverId.username,
            email: due.driverId.email,
            role: due.driverId.role,
            isDriver: due.driverId.role === "3",
            restaurantId: due.driverId.restaurantId,
          }
        : null;

      const order = due.orderId
        ? {
            _id: due.orderId._id,
            customerName: due.orderId.name,
            customerEmail: due.orderId.email,
            amount: due.orderId.amount,
            deliveryPrice: due.orderId.deliveryPrice,
            status: due.orderId.status,
            address: due.orderId.address,
            location: due.orderId.location,
            createdAt: due.orderId.createdAt,
            products: due.orderId.products.map((item) => ({
              _id: item.productId?._id,
              title: item.productId?.title,
              price: item.productId?.price,
              quantity: item.quantity,
              total: item.productId ? item.productId.price * item.quantity : 0,
            })),
          }
        : null;

      return {
        _id: due._id,
        amount: due.amount,
        status: due.status,
        createdAt: due.createdAt,
        updatedAt: due.updatedAt,
        driver,
        order,
        // Summary fields for easy display
        summary: {
          driverName: driver?.username || "Unknown Driver",
          customerName: order?.customerName || "Unknown Customer",
          restaurantName: due.restaurantInfo?.name || "Unknown Restaurant",
          orderAmount: order?.amount || 0,
          dueAmount: due.amount,
          status: due.status,
        },
      };
    });

    res.json({
      success: true,
      count: transformedDues.length,
      data: transformedDues,
    });
  } catch (error) {
    console.error("Error in getDriverDues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve driver dues",
      error: error.message,
    });
  }
};

const updateDriverDuesStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate the input
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // Check if the dues record exists
    const dues = await DriverDues.findById(id);
    if (!dues) {
      return res.status(404).json({ message: "Driver dues record not found" });
    }

    // Update the status
    dues.status = status;
    await dues.save();

    res.json({
      message: "Driver dues status updated successfully",
      updatedDues: dues,
    });
  } catch (error) {
    console.error("Error updating driver dues status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ========================================================
// TSP Algorthim !
// ========================================================
const suggestOrderGroupings = async (req, res) => {
  try {
    const { restaurantId, maxGroupSize = 3, maxDistanceKm = 5 } = req.query;

    // validate restaurantId
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res
        .status(400)
        .json({ message: "Valid Restaurant ID is required" });
    }
    // get restaurant with location validation
    const restaurant = await Restaurant.findById(restaurantId);
    if (
      !restaurant ||
      !Array.isArray(restaurant.location) ||
      restaurant.location.length !== 2
    ) {
      return res
        .status(404)
        .json({ message: "Restaurant not found or has invalid location" });
    }
    const restaurantCoords = restaurant.location; // [lng, lat]

    // Get processing orders with driver validation
    const processingOrders = await Order.find({
      restaurantId: restaurant._id,
      status: "Processing",
      $or: [{ driverId: { $exists: false } }, { driverId: null }],
    })
      .populate("userId", "-password -role")
      .populate({
        path: "products.productId",
        populate: [
          { path: "restaurantId", select: "-managers" },
          { path: "categoryId" },
        ],
      });

    //  location validation
    const validOrders = processingOrders.filter(
      (order) =>
        Array.isArray(order.location) &&
        order.location.length === 2 &&
        !isNaN(order.location[0]) &&
        !isNaN(order.location[1])
    );
    if (validOrders.length === 0) {
      return res.status(200).json({
        message: "No valid orders to group",
        debug: {
          totalOrders: processingOrders.length,
          invalidLocations: processingOrders.length - validOrders.length,
        },
        groupings: [],
      });
    }

    // add distance calculations
    const ordersWithDistance = validOrders.map((order) => {
      const distance = getDistanceInKm(restaurantCoords, order.location);
      return {
        ...order.toObject(),
        coords: order.location,
        distanceFromRestaurant: distance,
      };
    });

    // SIMPLE GRID CLUSTERING
    const gridSize = maxDistanceKm / Math.sqrt(2);
    const clusters = new Map();

    // 1° latitude ≈ 111 km at equator
    // 1° longitude ≈ 111 km × cos(latitude)
    ordersWithDistance.forEach((order) => {
      const [lng, lat] = order.coords;
      const gridX = Math.floor(lng / gridSize);
      const gridY = Math.floor(lat / gridSize);
      const gridKey = `${gridX},${gridY}`;

      if (!clusters.has(gridKey)) clusters.set(gridKey, []);
      clusters.get(gridKey).push(order);
    });

    const result = Array.from(clusters.values()).flatMap((cluster) => {
      // Sort by distance from restaurant
      cluster.sort(
        (a, b) => a.distanceFromRestaurant - b.distanceFromRestaurant
      );

      const groups = [];
      while (cluster.length > 0) {
        // get the maxGroupSize(3) nearest orders
        const group = cluster.splice(0, maxGroupSize);

        // TSP // if there is only 1 order no TSP nedded
        if (group.length > 1) {
          let currentLocation = restaurantCoords;
          const route = [];
          let remaining = [...group];

          while (remaining.length > 0) {
            let nearestIndex = 0;
            let minDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
              const dist = getDistanceInKm(
                currentLocation,
                remaining[i].coords
              );
              if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
              }
            }

            route.push(remaining[nearestIndex]);
            currentLocation = remaining[nearestIndex].coords;
            remaining.splice(nearestIndex, 1);
          }
          groups.push(route);
        } else {
          groups.push(group);
        }
      }

      // calculate route data
      return groups.map((group) => {
        let totalDistance = 0;
        let current = restaurantCoords;
        const path = [];

        group.forEach((order) => {
          const dist = getDistanceInKm(current, order.coords);
          totalDistance += dist;

          const { userId, ...orderData } = order;
          const safeUser = userId
            ? {
                _id: userId._id,
                username: userId.username,
                email: userId.email,
              }
            : null;

          path.push({
            order: { ...orderData, userId: safeUser },
            distanceFromPrev: `${dist.toFixed(2)} km`,
          });
          current = order.coords;
        });

        // return trip
        totalDistance += getDistanceInKm(current, restaurantCoords);

        return {
          orders: path,
          totalOrders: group.length,
          totalDistance: `${totalDistance.toFixed(2)} km`,
          estimatedDeliveryTime: `${Math.round(totalDistance * 3)} mins`,
        };
      });
    });

    // adjusting responce
    res.status(200).json({
      success: true,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        location: restaurantCoords,
      },
      groupings: result,
      stats: {
        totalOrders: processingOrders.length,
        validOrders: validOrders.length,
        totalGroups: result.length,
      },
    });
  } catch (err) {
    console.error("Grouping error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
};

const assignDriverToGroup = async (req, res) => {
  try {
    const { orderIds, driverId } = req.body;

    // 1. Basic validation
    if (!Array.isArray(orderIds)) {
      return res.status(400).json({ message: "orderIds must be an array" });
    }
    if (!driverId) {
      return res.status(400).json({ message: "driverId is required" });
    }

    // 2. Verify driver exists and is a driver (role 3)
    const driver = await User.findOne({ _id: driverId, role: "3" });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // 3. Get settings for driver percentage
    const settings = await Settings.findOne();
    const driverPercentage = settings?.driverPercentage || 20;

    // 4. Find all valid processing orders
    const orders = await Order.find({
      _id: { $in: orderIds },
      status: "Processing",
      $or: [{ driverId: { $exists: false } }, { driverId: null }],
    });

    // 5. Check if all orders were found and are valid
    if (orders.length !== orderIds.length) {
      const invalidOrders = orderIds.filter(
        (id) => !orders.some((order) => order._id.equals(id))
      );
      return res.status(400).json({
        message: "Some orders cannot be assigned",
        invalidOrders,
      });
    }

    // 6. Verify all orders belong to the same restaurant
    const restaurantId = orders[0].restaurantId;
    const sameRestaurant = orders.every((order) =>
      order.restaurantId.equals(restaurantId)
    );
    if (!sameRestaurant) {
      return res.status(400).json({
        message: "All orders must be from the same restaurant",
      });
    }

    // 7. Update orders and create driver dues
    const updateOps = orders.map((order) => ({
      updateOne: {
        filter: { _id: order._id },
        update: {
          $set: {
            status: "Shipping",
            driverId: driver._id,
          },
        },
      },
    }));

    const dueDocs = orders.map((order) => ({
      driverId: driver._id,
      orderId: order._id,
      amount: (order.deliveryPrice * driverPercentage) / 100,
      status: "Pending",
    }));

    // Execute all operations in bulk
    await Order.bulkWrite(updateOps);
    await DriverDues.insertMany(dueDocs);

    // 8. Return success response
    res.json({
      success: true,
      message: `Driver assigned to ${orders.length} orders`,
      driver: {
        _id: driver._id,
        name: driver.username,
      },
      restaurant: {
        _id: restaurantId,
      },
    });
  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to assign driver",
      error: err.message,
    });
  }
};

// =========================================================
// K-Means
// =========================================================
const suggestOrderGroupingsWithKmeans = async (req, res) => {
  try {
    const { restaurantId, maxGroupSize = 3, maxDistanceKm = 5 } = req.query;

    // 1. Validate restaurantId — O(1)
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res
        .status(400)
        .json({ message: "Valid Restaurant ID is required" });
    }

    // 2. Fetch restaurant — O(1) (indexed query)
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant?.location?.length === 2) {
      return res
        .status(404)
        .json({ message: "Restaurant not found or invalid location" });
    }
    const restaurantCoords = restaurant.location; // [lng, lat]

    // 3. Fetch processing orders — O(n) (n = orders)
    const processingOrders = await Order.find({
      restaurantId: restaurant._id,
      status: "Processing",
      $or: [{ driverId: { $exists: false } }, { driverId: null }],
    }).populate("userId", "-password -role");

    // 4. Filter valid orders — O(n)
    const validOrders = processingOrders.filter(
      (order) => Array.isArray(order.location) && order.location.length === 2
    );

    if (validOrders.length === 0) {
      return res
        .status(200)
        .json({ message: "No valid orders to group", groupings: [] });
    }

    // 5. Add distance from restaurant — O(n)
    const ordersWithDistance = validOrders.map((order) => ({
      ...order.toObject(),
      coords: order.location,
      distanceFromRestaurant: getDistanceInKm(restaurantCoords, order.location),
    }));

    // 6. K-Means Clustering — O(n × k × i)
    // (k = clusters, i = iterations ≈ 10)
    const k = Math.ceil(validOrders.length / maxGroupSize); // Dynamic 'k'
    const clusters = kMeansClustering(ordersWithDistance, k);

    // 7. Apply Nearest Neighbor TSP per cluster — O(m²) per cluster
    // (m = orders per cluster, worst-case: O(n²) if all orders in one cluster)
    const groupings = clusters.flatMap((cluster) => {
      if (cluster.length <= maxGroupSize) return [cluster]; // No TSP needed
      return solveTSPNearestNeighbor(cluster, restaurantCoords, maxGroupSize);
    });

    // 8. Calculate route metrics — O(g × m) (g = groups, m = maxGroupSize)
    const result = groupings.map((group) =>
      calculateRouteMetrics(group, restaurantCoords)
    );

    res.status(200).json({
      success: true,
      restaurant: { _id: restaurant._id, name: restaurant.name },
      groupings: result,
      stats: {
        totalOrders: processingOrders.length,
        validOrders: validOrders.length,
      },
    });
  } catch (err) {
    console.error("Grouping error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// K-Means Clustering — O(n × k × i)
function kMeansClustering(orders, k = 3, maxIterations = 10) {
  // Initialize centroids randomly
  let centroids = orders.slice(0, k).map((order) => [...order.coords]);

  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters = Array(k)
      .fill()
      .map(() => []);

    // Assign each order to nearest centroid — O(n × k)
    orders.forEach((order) => {
      let nearestCentroidIdx = 0;
      let minDist = Infinity;
      centroids.forEach((centroid, i) => {
        const dist = getDistanceInKm(centroid, order.coords);
        if (dist < minDist) {
          minDist = dist;
          nearestCentroidIdx = i;
        }
      });
      clusters[nearestCentroidIdx].push(order);
    });

    // Update centroids — O(k × m) (m = avg cluster size)
    let converged = true;
    centroids = clusters.map((cluster) => {
      if (cluster.length === 0) return centroids[Math.floor(Math.random() * k)]; // Handle empty clusters
      const newCentroid = [
        cluster.reduce((sum, o) => sum + o.coords[0], 0) / cluster.length,
        cluster.reduce((sum, o) => sum + o.coords[1], 0) / cluster.length,
      ];
      if (
        getDistanceInKm(newCentroid, centroids[clusters.indexOf(cluster)]) >
        0.01
      )
        converged = false;
      return newCentroid;
    });

    if (converged) break;
  }
  return clusters;
}

// Nearest Neighbor TSP — O(m²) per cluster
function solveTSPNearestNeighbor(cluster, start, maxGroupSize) {
  const groups = [];
  let remaining = [...cluster];

  while (remaining.length > 0) {
    let current = start;
    const group = [];
    for (let i = 0; i < Math.min(maxGroupSize, remaining.length); i++) {
      let nearestIdx = 0;
      let minDist = Infinity;
      remaining.forEach((order, j) => {
        const dist = getDistanceInKm(current, order.coords);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = j;
        }
      });
      group.push(remaining[nearestIdx]);
      current = remaining[nearestIdx].coords;
      remaining.splice(nearestIdx, 1);
    }
    groups.push(group);
  }
  return groups;
}

// Calculate Route Metrics — O(m) per group
function calculateRouteMetrics(group, restaurantCoords) {
  let totalDistance = 0;
  let current = restaurantCoords;
  const path = [];

  group.forEach((order) => {
    const dist = getDistanceInKm(current, order.coords);
    totalDistance += dist;
    path.push({ order, distanceFromPrev: `${dist.toFixed(2)} km` });
    current = order.coords;
  });

  totalDistance += getDistanceInKm(current, restaurantCoords); // Return trip
  return {
    orders: path,
    totalDistance: `${totalDistance.toFixed(2)} km`,
    estimatedDeliveryTime: `${Math.round(totalDistance * 3)} mins`,
  };
}
module.exports = {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getAllOrders,
  generateInvoice,
  assignDriverToOrder,
  getDriverDues,
  updateDriverDuesStatus,
  suggestOrderGroupings,
  assignDriverToGroup,
};
