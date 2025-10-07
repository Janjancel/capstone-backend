// const mongoose = require("mongoose");


// const orderSchema = new mongoose.Schema({
//   userId: String,
//   items: Array,
//   total: Number,
//   address: Object,
//   status: { type: String, default: "Pending" },
//   createdAt: { type: Date, default: Date.now },
//   cancelledAt: Date,
// });

// module.exports = mongoose.model("Order", orderSchema);

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      name: String,
      quantity: Number,
      price: Number,
      image: String, // single Cloudinary URL for the item
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' }, // reference to original item
    },
  ],
  total: Number,
  address: Object,
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date,
});

module.exports = mongoose.model("Order", orderSchema);
