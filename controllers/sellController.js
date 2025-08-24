// // controllers/sellController.js
// const SellRequest = require("../models/SellRequest");

// exports.submitSellRequest = async (req, res) => {
//   try {
//     const { userId, name, contact, price, description, image, location } = req.body;

//     console.log("Incoming sell request:", req.body);

//     if (
//       !userId || !name || !contact || !price ||
//       !description || !image || !location?.lat || !location?.lng
//     ) {
//       return res.status(400).json({ message: "All fields are required." });
//     }

//     const newSell = new SellRequest({
//       userId,
//       name,
//       contact,
//       price,
//       description,
//       image,
//       location,
//       status: "pending",
//       createdAt: new Date(),
//     });

//     await newSell.save();

//     res.status(201).json({ message: "Sell request submitted successfully." });
//   } catch (error) {
//     console.error("SellController Error:", error.message);
//     res.status(500).json({ message: "Server error." });
//   }
// };

// // ✅ New: Get all sell requests
// exports.getAllSellRequests = async (req, res) => {
//   try {
//     const sellRequests = await SellRequest.find().sort({ createdAt: -1 });
//     res.status(200).json(sellRequests);
//   } catch (error) {
//     console.error("Fetch Error:", error.message);
//     res.status(500).json({ message: "Failed to fetch sell requests." });
//   }
// };

// // ✅ Update sell request status
// const mongoose = require("mongoose");

// exports.updateSellStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid ID format." });
//     }

//     if (!["pending", "accepted", "declined"].includes(status)) {
//       return res.status(400).json({ message: "Invalid status value." });
//     }

//     const sellRequest = await SellRequest.findByIdAndUpdate(
//       id,
//       { status },
//       { new: true }
//     );

//     if (!sellRequest) return res.status(404).json({ message: "Sell request not found." });

//     res.status(200).json(sellRequest);
//   } catch (error) {
//     console.error("Update status error:", error);
//     res.status(500).json({ message: "Server error." });
//   }
// };

const mongoose = require("mongoose");
const SellRequest = require("../models/SellRequest");

// Create a new sell request
// Create new sell request
exports.createSell = async (req, res) => {
  const { userId, name, contact, price, description, image, location } = req.body;

  if (!userId || !name || !contact || !price || !description || !location) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const newSell = await SellRequest.create({
      userId,
      name,
      contact,
      price,
      description,
      image: image || null,
      location,
      status: "Pending",
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, sellRequest: newSell });
  } catch (err) {
    console.error("Error creating sell request:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Get all sell requests
exports.getSellRequests = async (req, res) => {
  try {
    const requests = await SellRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("💥 Error fetching sell requests:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update status (Accept/Decline)
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const request = await SellRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Sell request not found" });

    request.status = status;
    await request.save();

    res.json({ status: request.status });
  } catch (err) {
    console.error("💥 Error updating sell status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete sell request
exports.deleteSell = async (req, res) => {
  console.log("🔥 deleteSell route hit with id:", req.params.id);

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn("❌ Invalid ObjectId received:", id);
    return res.status(400).json({ success: false, message: "Invalid ID format" });
  }

  try {
    const deleted = await SellRequest.findByIdAndDelete(id);

    if (!deleted) {
      console.warn("⚠️ Sell request not found:", id);
      return res.status(404).json({ success: false, message: "Sell request not found" });
    }

    console.log("✅ Successfully deleted request:", deleted._id);
    res.status(200).json({
      success: true,
      message: "Request deleted successfully",
      deletedId: deleted._id,
    });
  } catch (err) {
    console.error("💥 Server error during delete:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// const mongoose = require("mongoose");
// const SellRequest = require("../models/SellRequest");

// // Get all sell requests
// exports.getSellRequests = async (req, res) => {
//   try {
//     const requests = await SellRequest.find().sort({ createdAt: -1 });
//     res.json(requests);
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // Update status (Accept/Decline)
// exports.updateStatus = async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   try {
//     const request = await SellRequest.findById(id);
//     if (!request) return res.status(404).json({ message: "Sell request not found" });

//     request.status = status;
//     await request.save();

//     res.json({ status: request.status });
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// };




// // Delete sell request
// exports.deleteSell = async (req, res) => {
//   console.log("🔥 deleteSell route hit with id:", req.params.id);
//   console.log("Model collection name:", SellRequest.collection.name);
//   const { id } = req.params;
//   console.log("🗑️ DELETE request received for ID:", id);

//   // Validate ObjectId
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     console.warn("❌ Invalid ObjectId received:", id);
//     return res.status(400).json({ success: false, message: "Invalid ID format" });
//   }

//   try {
//     const deleted = await SellRequest.findByIdAndDelete(id);

//     if (!deleted) {
//       console.warn("⚠️ Sell request not found in collection 'sellrequests':", id);
//       return res.status(404).json({ success: false, message: "Sell request not found" });
//     }

//     console.log("✅ Successfully deleted request:", deleted._id);
//     res.status(200).json({
//       success: true,
//       message: "Request deleted successfully",
//       deletedId: deleted._id,
//     });
//   } catch (err) {
//     console.error("💥 Server error during delete:", err);
//     res.status(500).json({ success: false, message: "Server error", error: err.message });
//   }
// };
