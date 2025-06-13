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
    isAdmin: {
      type: Boolean,
      default: false,
      immutable: true, // prevent users from modifying it directly but can set it programmatically
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
