// const mongoose = require("mongoose");

// const CartSchema = new mongoose.Schema({
//   userId: String,
//   cartItems: [{ id: String, quantity: Number }],
// });

// module.exports = mongoose.model("Cart", CartSchema);

  const mongoose = require("mongoose");

  const CartSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    cartItems: [
      {
        id: { type: String, required: true },
        quantity: { type: Number, default: 1 },
      }
    ],
  });

  module.exports = mongoose.model("Cart", CartSchema);
