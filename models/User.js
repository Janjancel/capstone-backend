const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Embedded address schema
const addressSchema = new mongoose.Schema({
  region: { type: String },
  province: { type: String },
  city: { type: String },
  barangay: { type: String },
  street: { type: String },
  houseNo: { type: String },
  zipCode: { type: String }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ["admin", "client"],
    default: "client",
  },
  status: {
    type: String,
    enum: ["online", "offline"],
    default: "offline",
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  profilePic: {
    type: String, // base64 or URL
  },
  address: addressSchema,

    isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
}, { timestamps: true });

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

