const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "1", // 0 admin , 1 user , 2 manager
      enum: ["0", "1", "2", "3"], // 0=admin, 1=user, 2=manager , 3=driver
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
