

// const express = require("express");
// const router = express.Router();
// const Item = require("../models/Item");
// const { CATEGORIES } = require("../models/Item");
// const cloudinary = require("../config/cloudinary");
// const upload = require("../middleware/multer");

// // Helper: numbers
// const toNumberOrNull = (v) => {
//   if (v === null || v === undefined || v === "") return null;
//   const n = Number(v);
//   return Number.isNaN(n) ? null : n;
// };

// // ✅ Helper: categories normalizer (array | csv | json | legacy 'category')
// function normalizeCategories(body) {
//   let raw = body.categories ?? body["categories[]"];
//   const legacy = body.category; // keep accepting old single category

//   let arr = [];

//   if (Array.isArray(raw)) {
//     arr = raw;
//   } else if (typeof raw === "string" && raw.trim()) {
//     const s = raw.trim();
//     // Try JSON array first
//     if (s.startsWith("[") && s.endsWith("]")) {
//       try {
//         const parsed = JSON.parse(s);
//         if (Array.isArray(parsed)) arr = parsed;
//       } catch (_) {}
//     }
//     // Fallback to CSV
//     if (arr.length === 0) {
//       arr = s.split(",").map((t) => t.trim()).filter(Boolean);
//     }
//   }

//   if (legacy && typeof legacy === "string") {
//     arr.push(legacy.trim());
//   }

//   // Clean + enforce allowed names
//   const set = new Set(
//     arr
//       .filter(Boolean)
//       .map((t) => t.trim())
//       .filter((t) => CATEGORIES.includes(t))
//   );

//   if (set.size === 0) set.add("Uncategorized");
//   return Array.from(set);
// }

// // GET all items (optional filtering by categories)
// // /api/items?category=Chair
// // /api/items?categories=Chair,Bed&match=all|any (default any)
// router.get("/", async (req, res) => {
//   try {
//     const { category, categories, match } = req.query;
//     const filter = {};

//     if (category) {
//       filter.categories = category;
//     } else if (categories) {
//       const arr = categories
//         .split(",")
//         .map((t) => t.trim())
//         .filter(Boolean);
//       if (arr.length) {
//         filter.categories = match === "all" ? { $all: arr } : { $in: arr };
//       }
//     }

//     const items = await Item.find(filter).sort({ name: 1 });
//     res.json(items);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch items" });
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

// // POST add item with multiple images + multi-categories
// router.post("/", upload.array("images", 5), async (req, res) => {
//   try {
//     let imageUrls = [];
//     if (req.files?.length) {
//       const results = await Promise.all(
//         req.files.map((file) =>
//           cloudinary.uploader.upload(file.path, { folder: "items" })
//         )
//       );
//       imageUrls = results.map((r) => r.secure_url);
//     }

//     const price = toNumberOrNull(req.body.price);
//     const condition = toNumberOrNull(req.body.condition);

//     if (price === null) {
//       return res.status(400).json({ error: "Price must be a valid number" });
//     }
//     if (condition === null) {
//       return res
//         .status(400)
//         .json({ error: "Condition must be a number between 1 and 10" });
//     }
//     if (condition < 1 || condition > 10) {
//       return res
//         .status(400)
//         .json({ error: "Condition must be between 1 and 10" });
//     }

//     const categories = normalizeCategories(req.body);

//     const newItem = new Item({
//       name: req.body.name,
//       description: req.body.description,
//       price,
//       condition,
//       origin: req.body.origin,
//       age: req.body.age,
//       categories,          // ✅ multi-categories
//       images: imageUrls,
//     });

//     await newItem.save();
//     res.status(201).json(newItem);
//   } catch (err) {
//     console.error("Error adding item:", err);
//     if (err?.name === "ValidationError") {
//       return res.status(400).json({ error: err.message });
//     }
//     res.status(500).json({ error: "Failed to add item" });
//   }
// });

// // PUT update item (append new images, allow multi-categories)
// router.put("/:id", upload.array("images", 5), async (req, res) => {
//   try {
//     const existingItem = await Item.findById(req.params.id);
//     if (!existingItem) {
//       return res.status(404).json({ error: "Item not found" });
//     }

//     const updateData = { ...req.body };

//     if ("price" in updateData) {
//       const n = toNumberOrNull(updateData.price);
//       if (n === null) return res.status(400).json({ error: "Price must be a valid number" });
//       updateData.price = n;
//     }
//     if ("condition" in updateData) {
//       const c = toNumberOrNull(updateData.condition);
//       if (c === null) {
//         return res
//           .status(400)
//           .json({ error: "Condition must be a number between 1 and 10" });
//       }
//       if (c < 1 || c > 10) {
//         return res
//           .status(400)
//           .json({ error: "Condition must be between 1 and 10" });
//       }
//       updateData.condition = c;
//     }

//     // ✅ categories (accept array/csv/json/legacy)
//     if ("categories" in req.body || "category" in req.body || "categories[]" in req.body) {
//       updateData.categories = normalizeCategories(req.body);
//     }

//     // images (append if new)
//     if (req.files?.length) {
//       const results = await Promise.all(
//         req.files.map((file) =>
//           cloudinary.uploader.upload(file.path, { folder: "items" })
//         )
//       );
//       updateData.images = [
//         ...(existingItem.images || []),
//         ...results.map((r) => r.secure_url),
//       ];
//     } else {
//       updateData.images = existingItem.images;
//     }

//     const updatedItem = await Item.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true, runValidators: true }
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

/**
 * PATCH /:id/availability
 * - Update availability flags/quantity for an item.
 * - Accepts JSON body: { available: true|false, quantity: number }
 * - Either field (or both) may be provided. If neither is present or valid, returns 400.
 */
router.patch("/:id/availability", async (req, res) => {
  try {
    const existingItem = await Item.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    const update = {};
    let hasUpdate = false;

    // available can be boolean or string "true"/"false"
    if (req.body.available !== undefined) {
      const raw = req.body.available;
      if (typeof raw === "boolean") {
        update.available = raw;
        hasUpdate = true;
      } else if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (s === "true" || s === "false") {
          update.available = s === "true";
          hasUpdate = true;
        } else {
          return res.status(400).json({ error: "available must be boolean (true/false)" });
        }
      } else {
        return res.status(400).json({ error: "available must be boolean (true/false)" });
      }
    }

    // quantity (or stock) numeric update
    if (req.body.quantity !== undefined || req.body.stock !== undefined) {
      const rawQ = req.body.quantity !== undefined ? req.body.quantity : req.body.stock;
      const q = toNumberOrNull(rawQ);
      if (q === null || q < 0) {
        return res.status(400).json({ error: "quantity must be a non-negative number" });
      }
      // adopt field 'quantity' if it exists on model, else try 'stock'
      // We'll update both if both exist to be safe.
      update.quantity = q;
      update.stock = q; // harmless if schema doesn't define stock; mongoose will ignore unknown paths by default unless strict:false
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return res.status(400).json({ error: "No valid availability fields provided (available, quantity)" });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    res.json(updatedItem);
  } catch (err) {
    console.error("Availability update error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to update availability" });
  }
});

module.exports = router;
