// Import required libraries
const express = require("express");
const db = require("./dbConfig");
const bodyParser = require("body-parser");
const apiRoutes = require("./routes/apiRoutes");
const cors = require("cors"); // Import the cors middleware
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

dotenv.config();
// Create an instance of Express
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
); // Enable CORS for all routes

// Middleware to parse incoming requests with JSON payloads
app.use(bodyParser.json());

// perform CRUD operation on cookies
app.use(cookieParser());
// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err);
    return;
  }
  console.log("Connected to the MySQL database");
});

// Mount the API routes
app.use("/api", apiRoutes);

// Start the server
// You can change this to any port you prefer
app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
