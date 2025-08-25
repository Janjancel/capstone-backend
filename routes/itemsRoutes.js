

// const express = require("express");
// const router = express.Router();
// const Item = require("../models/Item");
// const cloudinary = require("../config/cloudinary");
// const upload = require("../middleware/multer");

// // GET all items
// router.get("/", async (req, res) => {
//   try {
//     const items = await Item.find().sort({ name: 1 });
//     res.json(items);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch items" });
//   }
// });

// // POST add item with image upload
// router.post("/", upload.single("image"), async (req, res) => {
//   try {
//     let imageUrl = "";

//     if (req.file) {
//       const result = await cloudinary.uploader.upload(req.file.path, {
//         folder: "items", // optional folder
//       });
//       imageUrl = result.secure_url;
//     }

//     const newItem = new Item({
//       name: req.body.name,
//       description: req.body.description,
//       price: req.body.price,
//       origin: req.body.origin,
//       age: req.body.age,
//       image: imageUrl,
//     });

//     await newItem.save();
//     res.status(201).json(newItem);
//   } catch (err) {
//     console.error("Error adding item:", err);
//     res.status(500).json({ error: "Failed to add item" });
//   }
// });

// // PUT update item (with optional new image)
// router.put("/:id", upload.single("image"), async (req, res) => {
//   try {
//     let updateData = { ...req.body };

//     if (req.file) {
//       const result = await cloudinary.uploader.upload(req.file.path, {
//         folder: "items",
//       });
//       updateData.image = result.secure_url;
//     }

//     const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true });
//     res.json(updatedItem);
//   } catch (err) {
//     console.error("Item update error:", err);
//     res.status(500).json({ error: "Failed to update item" });
//   }
// });

// // DELETE item
// router.delete("/:id", async (req, res) => {
//   try {
//     await Item.findByIdAndDelete(req.params.id);
//     res.json({ message: "Item deleted" });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to delete item" });
//   }
// });

// // GET single item
// router.get("/:id", async (req, res) => {
//   try {
//     const item = await Item.findById(req.params.id);
//     if (!item) return res.status(404).json({ message: "Item not found" });
//     res.json(item);
//   } catch (err) {
//     console.error("Error fetching item:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/multer");

// GET all items
router.get("/", async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// POST add item with image upload
router.post("/", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "items", // optional folder
      });
      imageUrl = result.secure_url;
    }

    const newItem = new Item({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      origin: req.body.origin,
      age: req.body.age,
      image: imageUrl,
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// PUT update item (with optional new image)
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    let updateData = { ...req.body };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "items",
      });
      updateData.image = result.secure_url;
    }

    const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedItem);
  } catch (err) {
    console.error("Item update error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE item
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// GET single item
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
