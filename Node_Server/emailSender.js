"use strict";
const nodemailer = require("nodemailer");

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: "raheelmughal018@gmail.com",
    pass: "beaydffqhkqehlpz",
  },
});

module.exports = transporter;
