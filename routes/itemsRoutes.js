// const express = require("express");
// const router = express.Router();
// const Item = require("../models/Item");
// const cloudinary = require("../config/cloudinary");
// const upload = require("../middleware/multer");

// // Helper: coerce numbers safely
// const toNumberOrNull = (v) => {
//   if (v === null || v === undefined || v === "") return null;
//   const n = Number(v);
//   return Number.isNaN(n) ? null : n;
// };

// // GET all items
// router.get("/", async (req, res) => {
//   try {
//     const items = await Item.find().sort({ name: 1 });
//     res.json(items);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch items" });
//   }
// });

// // POST add item with multiple images
// router.post("/", upload.array("images", 5), async (req, res) => {
//   try {
//     let imageUrls = [];

//     if (req.files && req.files.length > 0) {
//       const uploadPromises = req.files.map((file) =>
//         cloudinary.uploader.upload(file.path, { folder: "items" })
//       );
//       const results = await Promise.all(uploadPromises);
//       imageUrls = results.map((result) => result.secure_url);
//     }

//     const price = toNumberOrNull(req.body.price);
//     const condition = toNumberOrNull(req.body.condition);

//     if (price === null) {
//       return res.status(400).json({ error: "Price must be a valid number" });
//     }
//     if (condition === null) {
//       return res.status(400).json({ error: "Condition must be a number between 1 and 10" });
//     }
//     if (condition < 1 || condition > 10) {
//       return res.status(400).json({ error: "Condition must be between 1 and 10" });
//     }

//     const newItem = new Item({
//       name: req.body.name,
//       description: req.body.description,
//       price,
//       condition, // ✅ save condition
//       origin: req.body.origin,
//       age: req.body.age,
//       category: req.body.category, // ✅ save category
//       images: imageUrls, // ✅ save array of URLs
//     });

//     await newItem.save();
//     res.status(201).json(newItem);
//   } catch (err) {
//     console.error("Error adding item:", err);
//     // Surface mongoose validation errors cleanly
//     if (err?.name === "ValidationError") {
//       return res.status(400).json({ error: err.message });
//     }
//     res.status(500).json({ error: "Failed to add item" });
//   }
// });

// router.put("/:id", upload.array("images", 5), async (req, res) => {
//   try {
//     let updateData = { ...req.body };

//     // Normalize numeric fields if present
//     if ("price" in updateData) {
//       const n = toNumberOrNull(updateData.price);
//       if (n === null) {
//         return res.status(400).json({ error: "Price must be a valid number" });
//       }
//       updateData.price = n;
//     }
//     if ("condition" in updateData) {
//       const c = toNumberOrNull(updateData.condition);
//       if (c === null) {
//         return res.status(400).json({ error: "Condition must be a number between 1 and 10" });
//       }
//       if (c < 1 || c > 10) {
//         return res.status(400).json({ error: "Condition must be between 1 and 10" });
//       }
//       updateData.condition = c;
//     }

//     // Find existing item
//     const existingItem = await Item.findById(req.params.id);
//     if (!existingItem) {
//       return res.status(404).json({ error: "Item not found" });
//     }

//     // Handle new image uploads
//     if (req.files && req.files.length > 0) {
//       const uploadPromises = req.files.map((file) =>
//         cloudinary.uploader.upload(file.path, { folder: "items" })
//       );
//       const results = await Promise.all(uploadPromises);

//       // ✅ Append new images to existing ones (instead of replacing)
//       updateData.images = [
//         ...(existingItem.images || []),
//         ...results.map((result) => result.secure_url),
//       ];
//     } else {
//       // ✅ Keep existing images if none uploaded
//       updateData.images = existingItem.images;
//     }

//     const updatedItem = await Item.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       {
//         new: true,
//         runValidators: true, // ✅ enforce min/max/required rules (where applicable)
//       }
//     );

//     res.json(updatedItem);
//   } catch (err) {
//     console.error("Item update error:", err);
//     if (err?.name === "ValidationError") {
//       return res.status(400).json({ error: err.message });
//     }
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

// // POST add item as featured
// const FeaturedItem = require("../models/FeaturedItem");

// router.post("/:id/feature", async (req, res) => {
//   try {
//     const item = await Item.findById(req.params.id);
//     if (!item) return res.status(404).json({ error: "Item not found" });

//     const existing = await FeaturedItem.findOne({ item: item._id });
//     if (existing) {
//       return res.status(400).json({ error: "Item already featured" });
//     }

//     const featured = new FeaturedItem({ item: item._id });
//     await featured.save();

//     res.status(201).json(featured);
//   } catch (err) {
//     console.error("Error featuring item:", err);
//     res.status(500).json({ error: "Failed to feature item" });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const { CATEGORIES } = require("../models/Item");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/multer");

// Helper: numbers
const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// ✅ Helper: categories normalizer (array | csv | json | legacy 'category')
function normalizeCategories(body) {
  let raw = body.categories ?? body["categories[]"];
  const legacy = body.category; // keep accepting old single category

  let arr = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    const s = raw.trim();
    // Try JSON array first
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) arr = parsed;
      } catch (_) {}
    }
    // Fallback to CSV
    if (arr.length === 0) {
      arr = s.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  if (legacy && typeof legacy === "string") {
    arr.push(legacy.trim());
  }

  // Clean + enforce allowed names
  const set = new Set(
    arr
      .filter(Boolean)
      .map((t) => t.trim())
      .filter((t) => CATEGORIES.includes(t))
  );

  if (set.size === 0) set.add("Uncategorized");
  return Array.from(set);
}

// GET all items (optional filtering by categories)
// /api/items?category=Chair
// /api/items?categories=Chair,Bed&match=all|any (default any)
router.get("/", async (req, res) => {
  try {
    const { category, categories, match } = req.query;
    const filter = {};

    if (category) {
      filter.categories = category;
    } else if (categories) {
      const arr = categories
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (arr.length) {
        filter.categories = match === "all" ? { $all: arr } : { $in: arr };
      }
    }

    const items = await Item.find(filter).sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
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

// POST add item with multiple images + multi-categories
router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    let imageUrls = [];
    if (req.files?.length) {
      const results = await Promise.all(
        req.files.map((file) =>
          cloudinary.uploader.upload(file.path, { folder: "items" })
        )
      );
      imageUrls = results.map((r) => r.secure_url);
    }

    const price = toNumberOrNull(req.body.price);
    const condition = toNumberOrNull(req.body.condition);

    if (price === null) {
      return res.status(400).json({ error: "Price must be a valid number" });
    }
    if (condition === null) {
      return res
        .status(400)
        .json({ error: "Condition must be a number between 1 and 10" });
    }
    if (condition < 1 || condition > 10) {
      return res
        .status(400)
        .json({ error: "Condition must be between 1 and 10" });
    }

    const categories = normalizeCategories(req.body);

    const newItem = new Item({
      name: req.body.name,
      description: req.body.description,
      price,
      condition,
      origin: req.body.origin,
      age: req.body.age,
      categories,          // ✅ multi-categories
      images: imageUrls,
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error adding item:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to add item" });
  }
});

// PUT update item (append new images, allow multi-categories)
router.put("/:id", upload.array("images", 5), async (req, res) => {
  try {
    const existingItem = await Item.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    const updateData = { ...req.body };

    if ("price" in updateData) {
      const n = toNumberOrNull(updateData.price);
      if (n === null) return res.status(400).json({ error: "Price must be a valid number" });
      updateData.price = n;
    }
    if ("condition" in updateData) {
      const c = toNumberOrNull(updateData.condition);
      if (c === null) {
        return res
          .status(400)
          .json({ error: "Condition must be a number between 1 and 10" });
      }
      if (c < 1 || c > 10) {
        return res
          .status(400)
          .json({ error: "Condition must be between 1 and 10" });
      }
      updateData.condition = c;
    }

    // ✅ categories (accept array/csv/json/legacy)
    if ("categories" in req.body || "category" in req.body || "categories[]" in req.body) {
      updateData.categories = normalizeCategories(req.body);
    }

    // images (append if new)
    if (req.files?.length) {
      const results = await Promise.all(
        req.files.map((file) =>
          cloudinary.uploader.upload(file.path, { folder: "items" })
        )
      );
      updateData.images = [
        ...(existingItem.images || []),
        ...results.map((r) => r.secure_url),
      ];
    } else {
      updateData.images = existingItem.images;
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(updatedItem);
  } catch (err) {
    console.error("Item update error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
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

// POST add item as featured
const FeaturedItem = require("../models/FeaturedItem");
router.post("/:id/feature", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const existing = await FeaturedItem.findOne({ item: item._id });
    if (existing) {
      return res.status(400).json({ error: "Item already featured" });
    }

    const featured = new FeaturedItem({ item: item._id });
    await featured.save();

    res.status(201).json(featured);
  } catch (err) {
    console.error("Error featuring item:", err);
    res.status(500).json({ error: "Failed to feature item" });
  }
});

module.exports = router;
