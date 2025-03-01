const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  // console.log("🚀 ~ helperFunctions.js:4 ~ password:", password);
  return await bcrypt.hash(password, 10);
};

const ComparePassword = async (password, user) => {
  return await bcrypt.compare(password, user.password);
};

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

module.exports = { hashPassword, ComparePassword, generateVerificationCode };
