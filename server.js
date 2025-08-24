

// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();

// const heritageRoutes = require('./routes/heritageRoutes');
// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// const db = require('./config/db'); // PostgreSQL connection

// const app = express();
// const PORT = process.env.PORT || 5000;

// // ✅ CORS setup
// const corsOptions = {
//   origin: 'http://localhost:3000',  // Your React frontend's origin
//   credentials: true,                // Allow credentials like cookies to be sent
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
//   allowedHeaders: ['Content-Type', 'Authorization'],    // Allowed headers
// };

// app.use(cors(corsOptions));  // Apply CORS to all routes
// app.options('*', cors(corsOptions)); // Handle preflight requests

// app.use(express.json()); // Parse incoming JSON requests

// // ✅ Connect to PostgreSQL
// db.connect()
//   .then(() => console.log('✅ PostgreSQL connected'))
//   .catch(err => console.error('❌ PostgreSQL connection error:', err));

// // ✅ Routes
// app.use('/api/heritage', heritageRoutes);
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

// // ✅ Test route to confirm CORS is working
// app.get('/api/test', (req, res) => {
//   res.json({ message: 'CORS working' });
// });

// // ✅ Start the server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });


// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db'); // ✅ MongoDB connection file
const path = require("path");
const multer = require("multer");
const router = express.Router();

const heritageRoutes = require('./routes/heritageRoutes');
const authRoutes = require('./routes/authRoutes/authRoutes');
const userRoutes = require('./routes/userRoutes');
// const demolishReqRoutes = require('./routes/demolishReqRoutes');
const itemsRoutes = require("./routes/itemsRoutes");
const cartRoutes = require("./routes/Cart");
const orderRoutes = require("./routes/orders");
const addressRouter = require('./routes/addressRoutes');
const notifRoutes = require("./routes/notifications");
const salesRoutes = require("./routes/sales");
const sellRoutes = require("./routes/sellRoutes");
const demolishRoutes = require("./routes/demolish");
const googleRegisterRoutes = require('./routes/authRoutes/googleRegister');
const uploadRoutes = require("./routes/upload");


// const profilePictureRoutes = require("./routes/ProfilePicture");

const app = express();
const PORT = process.env.PORT || 5000;


// CORS setup
// app.use(cors({
//   origin: "http://localhost:3000", // or your frontend domain
//   credentials: true,
// }));

// ✅ Connect to MongoDB
connectDB();

const allowedOrigins = [
  "http://localhost:3000",               // local dev
  "https://capstone-one-phi.vercel.app" // production frontend
];

const corsOptions = {
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman or mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true); // allowed
    } else {
      callback(new Error(`CORS policy does not allow access from ${origin}`), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Increase payload limit to 50MB (adjust as needed)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));


// ✅ Middleware setup
// const corsOptions = {
//   origin: [
//   'http://localhost:3000', // for local dev
//   'https://capstone-one-phi.vercel.app' // for Vercel frontend
// ],
// // origin: 'https://capstone-one-phi.vercel.app', // ✅ exact string, not array
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // Handles preflight requests
app.use(express.json());
// app.use('/uploads', express.static('uploads')); // Serve uploaded static files
// Serve files in the uploads folder as static files
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.use('/api/heritage', heritageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/demolish', demolishReqRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use('/api/address', addressRouter);
app.use("/api/notifications", notifRoutes);
// app.use("/api/users", profilePictureRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/sell", sellRoutes);
app.use("/api/demolish", demolishRoutes);

app.use('/api/auth/google-register', googleRegisterRoutes);
app.use("/api/upload", uploadRoutes)

app.use("/uploads", express.static("uploads"));
// ✅ Health Check Route
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS and MongoDB working' });
});

// Serve uploaded files from the 'uploads' folder
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/"); // folder to save images
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname); // unique filename
//   },
// });

// const upload = multer({ storage,
//     limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
//  });

// app.post("/api/upload", upload.single("image"), (req, res) => {
//   if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
//   // Send back the URL of the uploaded file
//   res.json({ imageUrl: `/uploads/${req.file.filename}` });
// });

// ✅ Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

