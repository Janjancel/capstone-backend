
// const mongoose = require("mongoose");
// const bcrypt = require("bcrypt");

// // --- Counter model (for monthly sequences) ---
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'user:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// // Embedded address schema (NO coordinates here — coordinates are now separate on the user root)
// const addressSchema = new mongoose.Schema({
//   region: { type: String },
//   province: { type: String },
//   city: { type: String },
//   barangay: { type: String },
//   street: { type: String },
//   houseNo: { type: String },
//   zipCode: { type: String }
// }, { _id: false });

// // Reusable coordinates schema constant — lat/lng are integers per your validator
// const coordinatesSchema = new mongoose.Schema({
//   lat: {
//     type: Number,
//     default: null,

//   },
//   lng: {
//     type: Number,
//     default: null,

//   },
// }, { _id: false });

// const userSchema = new mongoose.Schema({
//   // Custom formatted ID: MM-####-YY
//   userId: {
//     type: String,
//     unique: true,
//     required: true,
//     trim: true,
//     match: [/^\d{2}-\d{4}-\d{2}$/, "Invalid ID format (MM-####-YY)"],
//   },

//   username: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     minlength: 3,
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     lowercase: true,
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 6,
//   },
//   role: {
//     type: String,
//     enum: ["admin", "client"],
//     default: "client",
//   },
//   status: {
//     type: String,
//     enum: ["online", "offline"],
//     default: "offline",
//   },
//   lastLogin: {
//     type: Date,
//     default: null,
//   },
//   profilePic: {
//     type: String, 
//   },

//   // Address (embedded, no coordinates here)
//   address: addressSchema,

//   // Coordinates grouped under `coordinates` on the user root
//   coordinates: coordinatesSchema,

//   isVerified: {
//     type: Boolean,
//     default: false,
//   },
//   verificationToken: {
//     type: String,
//   },
// }, { timestamps: true });

// /**
//  * Auto-generate userId as MM-####-YY
//  * - MM = current month (01-12)
//  * - #### = zero-padded monthly sequence
//  * - YY = last two digits of year
//  */
// userSchema.pre("validate", async function (next) {
//   try {
//     if (this.userId) return next(); // respect pre-set IDs (must still match regex)

//     const now = new Date();
//     const mm = String(now.getMonth() + 1).padStart(2, "0");
//     const yy = String(now.getFullYear() % 100).padStart(2, "0");

//     // One counter per month-year
//     const key = `user:${mm}-${yy}`;
//     const doc = await Counter.findOneAndUpdate(
//       { key },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     const seqStr = String(doc.seq).padStart(4, "0");
//     this.userId = `${mm}-${seqStr}-${yy}`;
//     return next();
//   } catch (err) {
//     return next(err);
//   }
// });

// // Password hashing middleware
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// // Method to compare password
// userSchema.methods.comparePassword = function (inputPassword) {
//   return bcrypt.compare(inputPassword, this.password);
// };

// userSchema.statics.updateStatus = async function (userId, status) {
//   return this.findByIdAndUpdate(
//     userId,
//     { status, lastLogin: new Date() },
//     { new: true }
//   );
// };

// module.exports = mongoose.models.User || mongoose.model("User", userSchema);


// // models/User.js
// const mongoose = require("mongoose");
// const bcrypt = require("bcrypt");

// // --- Counter model (for monthly sequences) ---
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'user:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// // Embedded address schema
// const addressSchema = new mongoose.Schema({
//   region: { type: String },
//   province: { type: String },
//   city: { type: String },
//   barangay: { type: String },
//   street: { type: String },
//   houseNo: { type: String },
//   zipCode: { type: String }
// }, { _id: false });

// // Coordinates schema
// const coordinatesSchema = new mongoose.Schema({
//   lat: { type: Number, default: null },
//   lng: { type: Number, default: null },
// }, { _id: false });

// const userSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     unique: true,
//     required: true,
//     trim: true,
//     match: [/^\d{2}-\d{4}-\d{2}$/, "Invalid ID format (MM-####-YY)"],
//   },

//   username: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     minlength: 3,
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     lowercase: true,
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 6,
//   },
//   role: {
//     type: String,
//     enum: ["admin", "client"],
//     default: "client",
//   },
//   status: {
//     type: String,
//     enum: ["online", "offline"],
//     default: "offline",
//   },
//   lastLogin: {
//     type: Date,
//     default: null,
//   },
//   profilePic: {
//     type: String,
//     default: null,
//   },

//   address: addressSchema,
//   coordinates: coordinatesSchema,

//   isVerified: {
//     type: Boolean,
//     default: false,
//   },
//   verificationToken: {
//     type: String,
//   },
// }, { timestamps: true });

// /**
//  * Auto-generate userId as MM-####-YY
//  */
// userSchema.pre("validate", async function (next) {
//   try {
//     if (this.userId) return next();

//     const now = new Date();
//     const mm = String(now.getMonth() + 1).padStart(2, "0");
//     const yy = String(now.getFullYear() % 100).padStart(2, "0");

//     const key = `user:${mm}-${yy}`;
//     const doc = await Counter.findOneAndUpdate(
//       { key },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     const seqStr = String(doc.seq).padStart(4, "0");
//     this.userId = `${mm}-${seqStr}-${yy}`;
//     return next();
//   } catch (err) {
//     return next(err);
//   }
// });

// // Password hashing middleware
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// userSchema.methods.comparePassword = function (inputPassword) {
//   return bcrypt.compare(inputPassword, this.password);
// };

// userSchema.statics.updateStatus = async function (userId, status) {
//   return this.findByIdAndUpdate(
//     userId,
//     { status, lastLogin: new Date() },
//     { new: true }
//   );
// };

// module.exports = mongoose.models.User || mongoose.model("User", userSchema);

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// --- Counter model (for monthly sequences) ---
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'user:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

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

// Coordinates schema
const coordinatesSchema = new mongoose.Schema({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
}, { _id: false });

// Personal info (new)
const personalInfoSchema = new mongoose.Schema({
  lastName: { type: String, trim: true, required: true },
  firstName: { type: String, trim: true, required: true },
  middleInitial: { type: String, trim: true, maxlength: 1, default: null },
  phoneNumber: { type: String, trim: true, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-\d{4}-\d{2}$/, "Invalid ID format (MM-####-YY)"],
  },

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
    type: String,
    default: null,
  },

  // new embedded personal info
  personalInfo: personalInfoSchema,

  address: addressSchema,
  coordinates: coordinatesSchema,

  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
}, { timestamps: true });

/**
 * Auto-generate userId as MM-####-YY
 */
userSchema.pre("validate", async function (next) {
  try {
    if (this.userId) return next();

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear() % 100).padStart(2, "0");

    const key = `user:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.userId = `${mm}-${seqStr}-${yy}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

userSchema.statics.updateStatus = async function (userId, status) {
  return this.findByIdAndUpdate(
    userId,
    { status, lastLogin: new Date() },
    { new: true }
  );
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
