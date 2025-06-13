const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",  // Use Gmail service for sending emails
  auth: {
    user: process.env.EMAIL_USER,  // Your Gmail address from environment variables
    pass: process.env.EMAIL_PASSWORD,  // Your Gmail password or app-specific password
  },
});

module.exports = transporter;
