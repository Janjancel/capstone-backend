// controllers/sellController.js
const SellRequest = require("../models/SellRequest");

exports.submitSellRequest = async (req, res) => {
  try {
    const { userId, name, contact, price, description, image, location } = req.body;

    console.log("Incoming sell request:", req.body);

    if (
      !userId || !name || !contact || !price ||
      !description || !image || !location?.lat || !location?.lng
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newSell = new SellRequest({
      userId,
      name,
      contact,
      price,
      description,
      image,
      location,
      status: "pending",
      createdAt: new Date(),
    });

    await newSell.save();

    res.status(201).json({ message: "Sell request submitted successfully." });
  } catch (error) {
    console.error("SellController Error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

// ✅ New: Get all sell requests
exports.getAllSellRequests = async (req, res) => {
  try {
    const sellRequests = await SellRequest.find().sort({ createdAt: -1 });
    res.status(200).json(sellRequests);
  } catch (error) {
    console.error("Fetch Error:", error.message);
    res.status(500).json({ message: "Failed to fetch sell requests." });
  }
};
