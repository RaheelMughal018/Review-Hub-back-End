const mysql = require("mysql2");

// MySQL database configuration
const db = mysql.createConnection({
  host: "localhost", // Change this if your database is hosted on a different server
  user: "root", // Replace with your MySQL username
  password: "1234", // Replace with your MySQL password
  database: "review_hub", // Replace with your database name
});

module.exports = db;
