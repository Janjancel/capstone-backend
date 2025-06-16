const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");

// 🔄 Save a new sale from a delivered order
router.post("/", async (req, res) => {
  try {
    const { orderId, userId, total, items, deliveredAt } = req.body;
    const sale = new Sale({
      orderId,
      userId,
      total,
      items,
      deliveredAt: deliveredAt || new Date(),
    });
    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    console.error("Failed to save sale:", err);
    res.status(500).json({ error: "Failed to save sale" });
  }
});

// 📦 GET all sales
router.get("/", async (req, res) => {
  try {
    const sales = await Sale.find().sort({ deliveredAt: -1 });
    res.json(sales);
  } catch (err) {
    console.error("Failed to fetch sales:", err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// 📅 GET sales by date range (query params: start, end)
router.get("/range", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  try {
    const sales = await Sale.find({
      deliveredAt: {
        $gte: new Date(start),
        $lte: new Date(end),
      },
    }).sort({ deliveredAt: -1 });

    res.json(sales);
  } catch (err) {
    console.error("Failed to fetch sales in range:", err);
    res.status(500).json({ error: "Failed to fetch sales in date range" });
  }
});

// 💰 GET total income from all sales
router.get("/total", async (req, res) => {
  try {
    const result = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$total" },
        },
      },
    ]);

    const totalIncome = result.length > 0 ? result[0].totalIncome : 0;
    res.json({ totalIncome });
  } catch (err) {
    console.error("Failed to calculate total income:", err);
    res.status(500).json({ error: "Failed to calculate total income" });
  }
});

module.exports = router;
