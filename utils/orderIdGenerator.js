// const Counter = require("../models//Counter");

// function monthToLetter(month) {
//   const letters = "ABCDEFGHIJKL";
//   return letters[month] || "X";
// }

// async function generateOrderId() {
//   const now = new Date();
//   const monthLetter = monthToLetter(now.getMonth());
//   const day = String(now.getDate()).padStart(2, "0");

//   // Key for monthly counter
//   const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

//   // Atomic increment or create counter
//   const counter = await Counter.findOneAndUpdate(
//     { key },
//     { $inc: { seq: 1 } },
//     { new: true, upsert: true, setDefaultsOnInsert: true }
//   );

//   const orderNumber = String(counter.seq).padStart(5, "0");

//   return `${monthLetter}${day}-${orderNumber}`;
// }

// module.exports = generateOrderId;


// utils/orderIdGenerator.js


function generateOrderId() {
  const now = new Date();
  const letters = "ABCDEFGHIJKL";
  const monthLetter = letters[now.getMonth()] || "X";
  const day = String(now.getDate()).padStart(2, "0");
  const uniqueNumber = now.getTime() % 100000; // last 5 digits of timestamp
  return `${monthLetter}${day}-${String(uniqueNumber).padStart(5, "0")}`;
}

module.exports = generateOrderId;
