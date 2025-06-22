const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.token;
  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Bearer ksnvglds.., the second element is token
    jwt.verify(token, process.env.JWT_SEC, (err, user) => {
      if (err) return res.status(403).json({ message: "Token is not valid" });
      req.user = user;
      next();
    });
  } else {
    return res.status(401).json({ message: "You are not authenticated!" });
  }
};

// Verify token and authorization (user can access their own data or admin can access any)
const verifyTokenAndAuth = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user._id == req.params.id || req.user.role == 0) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "You are not allowed to do that!" });
    }
  });
};

// Verify token and admin role (only role 0)
const verifyTokenAndAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.role == 0) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "You are not allowed to do that! Admin only." });
    }
  });
};

// Verify token and manager role (only role 2)
const verifyTokenAndManager = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.role == 2) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "You are not allowed to do that! Manager only." });
    }
  });
};

// Verify token and driver role (only role 3)
const verifyTokenAndDriver = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.role == 3) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "You are not allowed to do that! Driver only." });
    }
  });
};

// Verify token and either admin or manager role (roles 0 or 2)
const verifyTokenAndAdminOrManager = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && (req.user.role == 0 || req.user.role == 2)) {
      next();
    } else {
      return res.status(403).json({
        message: "You are not allowed to do that! Admin or Manager only.",
      });
    }
  });
};

const timeReq = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
};

module.exports = {
  verifyToken,
  verifyTokenAndAuth,
  verifyTokenAndAdmin,
  verifyTokenAndManager,
  verifyTokenAndDriver, // Added the new driver verification
  verifyTokenAndAdminOrManager,
  timeReq,
};
