
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
    console.error("Error fetching items:", err);
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
    const quantityRaw = req.body.quantity ?? req.body.qty ?? undefined;
    const quantity = toNumberOrNull(quantityRaw);

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

    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
      return res
        .status(400)
        .json({ error: "Quantity must be an integer >= 0" });
    }

    const categories = normalizeCategories(req.body);

    const newItem = new Item({
      name: req.body.name,
      description: req.body.description,
      price,
      condition,
      origin: req.body.origin,
      age: req.body.age,
      categories, // ✅ multi-categories
      images: imageUrls,
      // quantity defaults handled by schema if undefined; otherwise use provided
      ...(quantity !== null && { quantity }),
      // availability: if user provided explicit availability use it; else derive from quantity
      availability:
        typeof req.body.availability !== "undefined"
          ? Boolean(req.body.availability === "true" || req.body.availability === true)
          : (quantity === null ? true : quantity > 0),
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

    // quantity handling: accept 'quantity' or 'qty'
    if ("quantity" in req.body || "qty" in req.body) {
      const qRaw = req.body.quantity ?? req.body.qty;
      const q = toNumberOrNull(qRaw);
      if (q === null || !Number.isInteger(q) || q < 0) {
        return res.status(400).json({ error: "Quantity must be an integer >= 0" });
      }
      updateData.quantity = q;

      // If availability not explicitly provided, derive it from quantity
      if (typeof req.body.availability === "undefined") {
        updateData.availability = q > 0;
      }
    }

    // If availability explicitly provided in body, coerce it to boolean
    if ("availability" in req.body) {
      const av = req.body.availability;
      updateData.availability = av === true || av === "true" || av === "1" || av === 1;
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
      // keep existing images if none uploaded
      updateData.images = existingItem.images;
    }

    // Ensure we don't accidentally send unknown fields that mongoose schema will reject
    // (runValidators will catch schema issues anyway)
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Post-update safety: if quantity became 0 ensure availability is false (if not explicitly set)
    if (updatedItem && updatedItem.quantity === 0 && updatedItem.availability) {
      updatedItem.availability = false;
      await updatedItem.save();
    }

    // If quantity > 0 and availability is false, leave as-is unless user explicitly changed it
    res.json(updatedItem);
  } catch (err) {
    console.error("Item update error:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to update item" });
  }
});

/**
 * POST /:id/decrement
 * Atomically decrement an item's quantity by `amount` (default 1).
 * Body: { amount: <integer> }
 * Responses:
 *  - 200: returns updated item
 *  - 400: invalid amount or insufficient stock
 *  - 404: item not found
 *
 * Implementation notes:
 *  - Uses an atomic findOneAndUpdate (filter requires quantity >= amount) to avoid negative stock.
 *  - After the atomic decrement, if quantity reaches 0 we ensure availability is false.
 */
router.post("/:id/decrement", async (req, res) => {
  try {
    const id = req.params.id;
    const amountRaw = req.body.amount ?? req.body.qty ?? 1;
    const amount = toNumberOrNull(amountRaw) ?? 1;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: "Amount must be an integer >= 1" });
    }

    // Atomically decrement only if enough stock exists
    const updated = await Item.findOneAndUpdate(
      { _id: id, quantity: { $gte: amount } },
      { $inc: { quantity: -amount } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      // Check whether item exists or it's just insufficient stock
      const existing = await Item.findById(id);
      if (!existing) {
        return res.status(404).json({ error: "Item not found" });
      }
      return res.status(400).json({ error: "Insufficient stock to decrement" });
    }

    // If quantity reached 0, ensure availability is false
    if (updated.quantity === 0 && updated.availability) {
      updated.availability = false;
      await updated.save();
    }

    res.json(updated);
  } catch (err) {
    console.error("Error decrementing quantity:", err);
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to decrement quantity" });
  }
});

// DELETE item
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Error deleting item:", err);
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
