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
      status: "Pending",
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

const GOOGLE_MAPS_API_KEY = "AIzaSyDuuMp_q2HijskSPUzTcB3_wOiSubL1LV0";

const  getAddressFromGeo = async(lat, lng, locale = "en") {
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_MAPS_API_KEY,
          language: locale,
          region: "ar",
          location_type: "APPROXIMATE",
        },
      }
    );

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error("No results found for the given coordinates");
    }

    const addressComponents = response.data.results[0].address_components;
    let detailedAddress = "";

    // Construct the detailed address by excluding the country component
    for (let i = 0; i <= addressComponents.length - 1; i++) {
      const component = addressComponents[i];
      if (!component.types.includes("country")) {
        detailedAddress = `${component.long_name} - ${detailedAddress}`;
      }
    }

    // Remove the last hyphen and space if present
    if (detailedAddress.endsWith(" - ")) {
      detailedAddress = detailedAddress.slice(0, -3);
    }

    return detailedAddress;
  } catch (error) {
    console.error("Error fetching address:", error);
    throw error;
  }
}

const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the order with all necessary populated data
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get address from coordinates
    const [lat, lng] = order.location;
    const deliveryAddress =
      (await getAddressFromGeo(lat, lng, "en")) || order.address;

    // Populate user and products data
    const [user, populatedProducts] = await Promise.all([
      User.findById(order.userId).select("-password -role"),
      Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.productId)
            .populate({
              path: "restaurantId",
              select: "-managers",
              model: "Restaurant",
            })
            .populate("categoryId");
          return {
            ...item.toObject(),
            product: product
              ? {
                  ...product.toObject(),
                  restaurant: product.restaurantId,
                  category: product.categoryId,
                }
              : null,
          };
        })
      ),
    ]);

    // Create invoice data structure
    const invoiceData = {
      invoiceNumber: `INV-${order._id.toString().slice(-6).toUpperCase()}`,
      date: order.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      orderId: order._id,
      customer: {
        name: order.name,
        email: order.email,
        address: deliveryAddress,
        phone: user?.phone || "Not provided",
      },
      items: populatedProducts.map((item) => ({
        name: item.product?.title || "Unknown Product",
        description: item.product?.desc || "",
        quantity: item.quantity,
        unitPrice: item.product?.price || 0,
        total: (item.product?.price || 0) * item.quantity,
        restaurant: item.product?.restaurant?.name || "Unknown Restaurant",
        category: item.product?.category?.name || "Unknown Category",
      })),
      subtotal: order.amount - order.deliveryPrice,
      deliveryFee: order.deliveryPrice,
      total: order.amount,
      status: order.status,
      paymentMethod: "Credit Card", // You might want to add this to your Order model
      deliveryInstructions: "Leave at door", // You might want to add this to your Order model
    };

    // Generate PDF
    const PDFDocument = require("pdfkit");
    const fs = require("fs");

    // Create a document with better margins
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    // Set response headers for PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice-${invoiceData.invoiceNumber}.pdf`
    );

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add logo and header
    doc
      .image("logo.png", 50, 45, { width: 50 }) // Replace with your logo path
      .fillColor("#444444")
      .fontSize(20)
      .text("INVOICE", 110, 50, { align: "left" })
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
      .text("BILL TO:", 50, 110)
      .font("Helvetica-Bold")
      .text(invoiceData.customer.name, 50, 125)
      .font("Helvetica")
      .text(invoiceData.customer.address, 50, 140)
      .text(`Email: ${invoiceData.customer.email}`, 50, 155)
      .text(`Phone: ${invoiceData.customer.phone}`, 50, 170);

    // Order summary
    doc
      .font("Helvetica-Bold")
      .text("ORDER SUMMARY", 350, 110)
      .font("Helvetica")
      .text(`Order ID: ${invoiceData.orderId}`, 350, 125)
      .text(`Status: ${invoiceData.status}`, 350, 140)
      .text(
        `Delivery Instructions: ${invoiceData.deliveryInstructions}`,
        350,
        155
      )
      .moveDown();

    // Items table header
    doc.moveTo(50, 200).lineTo(550, 200).stroke();

    doc
      .font("Helvetica-Bold")
      .fillColor("#444444")
      .text("Item", 50, 210)
      .text("Category", 200, 210)
      .text("Restaurant", 300, 210)
      .text("Qty", 400, 210, { width: 50, align: "right" })
      .text("Price", 450, 210, { width: 50, align: "right" })
      .text("Total", 500, 210, { width: 50, align: "right" });

    doc.moveTo(50, 230).lineTo(550, 230).stroke();

    // Items table rows
    let y = 240;
    invoiceData.items.forEach((item) => {
      doc
        .font("Helvetica")
        .fillColor("#444444")
        .text(item.name, 50, y)
        .text(item.description, 50, y + 15, { width: 150, lineBreak: false })
        .text(item.category, 200, y, { width: 100, lineBreak: false })
        .text(item.restaurant, 300, y, { width: 100, lineBreak: false })
        .text(item.quantity.toString(), 400, y, { width: 50, align: "right" })
        .text(`$${item.unitPrice.toFixed(2)}`, 450, y, {
          width: 50,
          align: "right",
        })
        .text(`$${item.total.toFixed(2)}`, 500, y, {
          width: 50,
          align: "right",
        });

      y += 40;

      // Add space between items if description is long
      if (item.description.length > 30) {
        y += 15;
      }
    });

    // Summary section
    doc.moveTo(50, y).lineTo(550, y).stroke();

    doc
      .font("Helvetica")
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
      .font("Helvetica-Bold")
      .text("Total:", 400, y + 70)
      .text(`$${invoiceData.total.toFixed(2)}`, 500, y + 70, {
        width: 50,
        align: "right",
      });

    // Payment information
    doc
      .font("Helvetica")
      .text(`Payment Method: ${invoiceData.paymentMethod}`, 50, y + 100);

    // Footer
    doc
      .fontSize(10)
      .text("Thank you for your business!", 50, y + 150, { align: "center" })
      .text(
        "If you have any questions about this invoice, please contact us at support@yourcompany.com",
        50,
        y + 170,
        { align: "center" }
      );

    // Finalize the PDF
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderById,
  getAllOrders,
  generateInvoice,
};
