// const multer = require("multer");
// const path = require("path");

// // store file temporarily in memory
// const storage = multer.diskStorage({
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });

// const upload = multer({ storage });

// module.exports = upload;

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// ⚡ no limit on file size
const upload = multer({
  storage,
  limits: { fileSize: Infinity }, // effectively disables size limit
});

module.exports = upload;
