const express = require("express");
const db = require("../dbConfig");
const transporter = require("../emailSender.js");
const router = express.Router();
const jwt = require("jsonwebtoken");
const csv = require("csv-parser");
const fs = require("fs");
const { Transform } = require("stream");
const JSONStream = require("JSONStream");
const ytscraper = require("../ScrapperScript.js");
const scrapeAmazonReviews = require("../amazonscrapper.js");
const moment = require("moment");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/tokenGenerator.js");
const ApiError = require("../utils/apiError.js");
const ApiResponse = require("../utils/apiResponse.js");
const asyncHandler = require("../utils/asynchandler.js");
const {
  hashedPassword,
  ComparePassword,
  generateVerificationCode,
  hashPassword,
} = require("../utils/helperFunctions.js");
const protected = require("../middlewares/auth.middleware.js");
// Function to verify JWT token

// GET endpoint to retrieve users from the database and send them as JSON
router.get(
  "/users",
  protected,
  asyncHandler(async (req, res) => {
    const query = "SELECT * FROM user";
    const users = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    return res.json(new ApiResponse(200, users, "User Fetched Successfully"));
  })
);

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, name, password } = req.body;

    // ✅ Ensure all required fields are provided
    if (!email || !name || !password) {
      throw new ApiError(400, "All fields are required");
    }

    // ✅ Check if the email already exists in the database
    const checkEmailQuery = "SELECT * FROM user WHERE email = ?";
    const existingUsers = await new Promise((resolve, reject) => {
      db.query(checkEmailQuery, [email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (existingUsers.length > 0) {
      throw new ApiError(409, "Email is already registered");
    }

    // ✅ Hash password securely
    const hashedPassword = await hashPassword(password, 10);

    // ✅ Generate OTP and expiration time
    const verificationCode = generateVerificationCode();
    const otpExpiresAt = moment()
      .add(10, "minutes")
      .format("YYYY-MM-DD HH:mm:ss");

    // ✅ Send OTP via Email
    try {
      await transporter.sendMail({
        from: '"Review HUB" <raheelmughal018@gmail.com>',
        to: email,
        subject: "Verification Code",
        text: "Verification OTP",
        html: `
          <p>Dear ${name},</p>
          <p>Your One-Time Password (OTP) for verification is:</p>
          <h1>${verificationCode}</h1>
          <p>Please use this OTP within ${otpExpiresAt} to complete the verification process.</p>
          <p>Thank you!</p>
        `,
      });
    } catch (error) {
      throw new ApiError(503, "Failed to send verification email", error);
    }

    // ✅ Insert user into the database
    const insertUserQuery =
      "INSERT INTO user (email, name, password, two_FA_key, otp_expires,user_role) VALUES (?, ?, ?, ?, ?,?)";

    const user = await new Promise((resolve, reject) => {
      db.query(
        insertUserQuery,
        [email, name, hashedPassword, verificationCode, otpExpiresAt, "user"],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    const createdUserQuery = "SELECT * FROM User WHERE user_id = ?";
    const createdUser = await new Promise((resolve, reject) => {
      db.query(createdUserQuery, [user.insertId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, createdUser, "User created. Please verify OTP.")
      );
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    // ✅ Query database to find the user
    const query = "SELECT * FROM user WHERE email = ?";
    const results = await new Promise((resolve, reject) => {
      db.query(query, [email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (results.length === 0) {
      throw new ApiError(401, "Invalid email or password");
    }

    const user = results[0];
    console.log("🚀 ~ apiRoutes.js:165 ~ user:", user);

    const isPasswordValid = await ComparePassword(password, user);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = await generateToken(user);

    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: true,
    };

    // ✅ Send success response
    return res
      .cookie("token", token, { options })
      .status(200)
      .json(new ApiResponse(200, { user, token }, "Login successful"));
  })
);
router.post(
  "/logout",
  protected,
  asyncHandler(async (req, res) => {
    res
      .clearCookie("token")
      .status(200)
      .json(new ApiResponse(200, {}, "Logged out successfully"));
  })
);
router.get(
  "/profile",
  protected,
  asyncHandler(async (req, res) => {
    // console.log("🚀 ~ apiRoutes.js:169 ~ req:", req.user);
    const { user } = req;
    return res.json(new ApiResponse(200, user, "User profile retrieved"));
  })
);

router.delete(
  "/users/email",

  asyncHandler(async (req, res) => {
    const { email } = req.body;

    console.log("Deleting user with email:", email);

    if (!email) {
      throw new ApiError(500, "Email is required");
    }

    const deleteQuery = "DELETE FROM user WHERE email = ?";

    db.query(deleteQuery, [email], (err, result) => {
      if (err) {
        console.error("Error deleting user:", err);
        throw new ApiError(500, "Error while deleting user:", err);
      }

      // ✅ Check if any rows were affected
      if (result.affectedRows === 0) {
        throw new ApiError(404, "User not found");
      }

      return res.json(new ApiResponse(200, {}, "User deleted successfully"));
    });
  })
);

router.post(
  "/users/email",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    console.log("Fetching 2FA code for email:", email);

    if (!email) {
      throw new ApiError(400, "Email is required");
    }

    const query = "SELECT two_FA_key FROM user WHERE email = ?";

    db.query(query, [email], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        throw new ApiError(500, "Error fetching 2FA code");
      }

      // ✅ Check if a user exists with the provided email
      if (results.length === 0) {
        throw new ApiError(404, "User not found");
      }

      return res.json(
        new ApiResponse(200, results, "2FA code retrieved successfully")
      );
    });
  })
);
//my work

router.post("/contact", async (req, res) => {
  const { email, name, message } = req.body;

  // Ensure that required fields are provided
  if (!email || !name || !message) {
    return res.status(403).json({ error: "All fields are required" });
  }

  try {
    // Save feedback data to the database
    const insertFeedbackQuery =
      "INSERT INTO feedback (email, feedback) VALUES (?, ?)";
    db.query(insertFeedbackQuery, [email, message], (err, results) => {
      if (err) {
        console.error("Error saving feedback to database:", err);
        // You can choose to handle the error as needed
      }
    });

    // Send email
    let mail = await transporter.sendMail({
      from: '"Review HUB" <raheelmughal018@gmail.com>',
      to: "ayrish.hanif456@gmail.com", // Replace with the desired destination email address
      subject: "Contact Form Submission",
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `
        <p>Name: ${name}</p>
        <p>Email: ${email}</p>
        <p>Message: ${message}</p>
      `,
    });

    // You can add additional logic here if needed

    res.status(201).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Error sending email or saving feedback to database:", error);
    res.status(503).json({ error: "Failed to send email or save feedback" });
  }
});

var emailchng = null;

router.post("/frpass", (req, res) => {
  const { email } = req.body;
  console.log(email);
  emailchng = email;
  const verificationCode = generateVerificationCode();

  const query = `SELECT * FROM user WHERE email = '${email}'`; // Assuming 'user' is the table name

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    } else {
      if (results.length > 0) {
        let mail = transporter.sendMail({
          from: '"Review HUB" <furqana405@gmail.com>',
          to: `${email}`,
          subject: "Verification Code",
          text: "Verification OTP",
          html: `
            <p>Your One-Time Password (OTP) for verification is:</p>
            <h1>${verificationCode}</h1>
            <p>Please use this OTP to complete the verification process.</p>
            <p>Thank you!</p>
          `,
        });

        console.log(`Verification code sent to ${email}: ${verificationCode}`);
        res.json({ verificationCode });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  });
});

router.post("/changePassword", (req, res) => {
  const { newPassword } = req.body;

  try {
    // Update user's password
    const query = "UPDATE user SET password = ? WHERE email = ?";
    db.query(query, [newPassword, emailchng], (err, results) => {
      if (err) {
        console.error("Error updating password:", err);
        return res.status(500).json({ message: "Failed to update password" });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      console.log("working");
      return res.status(200).json({ message: "Password updated successfully" });
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({ message: "Failed to update password" });
  }
});

router.post("/receive_json", (req, res) => {
  const jsonData = req.body;
  console.log("Received JSON data:", jsonData);
  // Handle the JSON data as needed
  res.send("JSON data received successfully");
});

// Define a route for scraping data
router.post("/scrape_data", async (req, res) => {
  console.log("Checking if the server is up and running...");
  try {
    // Extract the YouTube video URL from the request body
    const videoUrl = req.body.videoURL;

    // Check if the videoUrl is provided
    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    // Call the ytscraper function with the provided videoUrl
    const scrapedData = await ytscraper(videoUrl);

    // // Convert scraped data to CSV format
    // const csvData = await convertToCSV(scrapedData);

    // Send a response with the scraped data in CSV format
    res.header("Content-Type", "text/csv");
    res.attachment("comments.csv");

    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log(scrapedData);
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");

    res.status(200).send(scrapedData);
  } catch (error) {
    console.error("Error scraping data:", error);

    // Send a meaningful error response
    res.status(500).json({
      error: "An error occurred while scraping data. Please try again later.",
    });
  }
});

// Function to convert JSON data to CSV format

router.post("/scrape_amazon", async (req, res) => {
  console.log("Checking if the server is up and running...");
  try {
    // Extract the YouTube video URL from the request body
    const videoUrl = req.body.videoURL;

    // Check if the videoUrl is provided
    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    const scrapedData = await scrapeAmazonReviews(videoUrl);

    res.header("Content-Type", "text/csv");
    res.attachment("comments.csv");

    console.log(
      "-------------------MAAAAAAAAAALIK1zaxzx-------------------------"
    );
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log(scrapedData);
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    console.log("-------------------MAAAAAAAAAALIK-------------------------");
    res.status(200).send(scrapedData);
  } catch (error) {
    console.error("Error scraping data:", error);

    // Send a meaningful error response
    res.status(500).json({
      error: "An error occurred while scraping data. Please try again later.",
    });
  }
});

module.exports = router;
