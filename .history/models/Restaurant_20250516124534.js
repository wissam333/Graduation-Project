const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    location: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    managers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Reference to the User model
        validate: {
          validator: async function (userId) {
            const user = await mongoose.model("User").findById(userId);
            return user && user.role === "2"; // Now checking for role '2' (basic user as manager)
          },
          message: "User is not a valid manager or does not exist",
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

RestaurantSchema.index({ location: "2dsphere" });
module.exports = mongoose.model("Restaurant", RestaurantSchema);
