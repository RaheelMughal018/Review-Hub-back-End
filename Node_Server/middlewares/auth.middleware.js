const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asynchandler");
const jwt = require("jsonwebtoken");
const db = require("../dbConfig");
const protected = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");
    // console.log("🚀 ~ auth.middleware.js:6 ~ token:", token);
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);

    const query = `SELECT user_id,name,email,verified FROM user WHERE user_id = ?`;

    const user = await new Promise((resolve, reject) => {
      db.query(query, [decodedToken.userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    // console.log("🚀 ~ auth.middleware.js:21 ~ result:", result);

    if (!user) {
      throw new ApiError(401, "Unauthorized request");
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("🚀 ~ auth.middleware.js:7 ~ error:", error);
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

module.exports = protected;
