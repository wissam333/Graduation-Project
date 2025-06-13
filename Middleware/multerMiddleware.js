const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Destination folder for storing uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // set filename for uploaded files
  },
});

const uploadImg = multer({ storage: storage }).single("img");
module.exports = uploadImg;
