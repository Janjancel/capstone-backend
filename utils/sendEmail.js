// const nodemailer = require("nodemailer");

// const sendEmail = async (to, subject, htmlContent) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,        // your Gmail (e.g. youremail@gmail.com)
//         pass: process.env.EMAIL_PASS,        // your App Password from Google
//       },
//     });

//     const mailOptions = {
//       from: `"E-Commerce App" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html: htmlContent,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log("📧 Email sent:", info.messageId);
//   } catch (error) {
//     console.error("❌ Email error:", error);
//     throw error;
//   }
// };

// module.exports = sendEmail;


// utils/sendEmail.js
const nodemailer = require("nodemailer");

// Create transporter ONCE (recommended)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,      // Gmail email
    pass: process.env.EMAIL_PASS,      // Gmail App Password (NOT your real password)
  },
  tls: {
    rejectUnauthorized: false, // Fixes some hosting/Gmail TLS issues
  },
});

// Verify transporter once on server start (helps debug)
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("📧 Email transporter is ready");
  }
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: `"E-Commerce App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      text: htmlContent.replace(/<[^>]+>/g, ""), // Fallback if HTML fails
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("📨 Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    throw error; // propagate to controller so register() catches it
  }
};

module.exports = sendEmail;
