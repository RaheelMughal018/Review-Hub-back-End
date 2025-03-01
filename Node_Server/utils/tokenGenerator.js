const jwt = require("jsonwebtoken");

const generateToken = async (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: process.env.JWT_EXPIRES,
    }
  );
};

module.exports = { generateToken };
