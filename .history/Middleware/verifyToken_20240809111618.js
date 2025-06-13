const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.token;
  if (authHeader) {
    const token = authHeader.split(" ")[1]; // Bearer ksnvglds.., the second element is token
    jwt.verify(token, process.env.JWT_SEC, (err, user) => {
      if (err) return res.status(403).json({ message: "token is not vaild" });
      req.user = user;
      next();
    });
  } else {
    return res.status(401).json({ message: "you are not authenticated!" });
  }
};

const verifyTokenAndAuth = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.id === req.params.id || req.user.isAdmin) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "you are not allowed to do that!" });
    }
  });
};

const verifyTokenAndAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user && req.user.isAdmin) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "you are not allowed to do that!" });
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

module.exports = { verifyToken, verifyTokenAndAuth, verifyTokenAndAdmin ,timeReq};
