
// // module.exports = router;

// const express = require('express');
// const router = express.Router();
// const mongoose = require('mongoose');
// const Heritage = require('../models/Heritage'); // correct path assumed

// // --- Helpers ---
// const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const handleError = (res, err) => {
//   console.error('❌ Heritage route error:', err);

//   // Mongoose validation errors
//   if (err?.name === 'ValidationError') {
//     return res.status(400).json({
//       message: 'Validation failed',
//       errors: Object.fromEntries(
//         Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
//       ),
//     });
//   }

//   // Bad ObjectId casting
//   if (err?.name === 'CastError') {
//     return res.status(400).json({ message: 'Invalid ID format' });
//   }

//   // Duplicate key (e.g., unique index)
//   if (err?.code === 11000) {
//     return res.status(409).json({
//       message: 'Duplicate key',
//       fields: err.keyValue || {},
//     });
//   }

//   return res.status(500).json({ message: 'Internal Server Error' });
// };

// // =========================
// // GET /api/heritage
// // (kept intact, returns all)
// // =========================
// router.get('/', async (req, res) => {
//   try {
//     const heritageSites = await Heritage.find();
//     res.status(200).json(heritageSites);
//   } catch (err) {
//     console.error('❌ Failed to fetch heritage sites:', err);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// });

// // =====================================
// // GET /api/heritage/:id  (fetch single)
// // =====================================
// router.get('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) {
//       return res.status(400).json({ message: 'Invalid ID format' });
//     }

//     const site = await Heritage.findById(id);
//     if (!site) return res.status(404).json({ message: 'Not found' });

//     res.status(200).json(site);
//   } catch (err) {
//     handleError(res, err);
//   }
// });

// // =====================================
// // POST /api/heritage  (add/create)
// // Body: JSON matching Heritage schema
// // =====================================
// router.post('/', async (req, res) => {
//   try {
//     const doc = new Heritage(req.body);
//     const saved = await doc.save();
//     res.status(201).json(saved);
//   } catch (err) {
//     handleError(res, err);
//   }
// });

// // =====================================
// // PUT /api/heritage/:id   (edit/replace)
// // PATCH /api/heritage/:id (edit/partial)
// // =====================================
// const updateHandler = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) {
//       return res.status(400).json({ message: 'Invalid ID format' });
//     }

//     const updated = await Heritage.findByIdAndUpdate(id, req.body, {
//       new: true,          // return updated doc
//       runValidators: true // honor schema validators on update
//     });

//     if (!updated) return res.status(404).json({ message: 'Not found' });
//     res.status(200).json(updated);
//   } catch (err) {
//     handleError(res, err);
//   }
// };

// router.put('/:id', updateHandler);
// router.patch('/:id', updateHandler);

// // ================================
// // DELETE /api/heritage/:id (delete)
// // ================================
// router.delete('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!isValidId(id)) {
//       return res.status(400).json({ message: 'Invalid ID format' });
//     }

//     const deleted = await Heritage.findByIdAndDelete(id);
//     if (!deleted) return res.status(404).json({ message: 'Not found' });

//     res.status(200).json({ message: 'Deleted successfully', id });
//   } catch (err) {
//     handleError(res, err);
//   }
// });

// module.exports = router;


// routes/heritage.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Heritage = require('../models/Heritage'); // correct path assumed
const Item = require('../models/Item'); // optional but recommended to verify items exist

// --- Helpers ---
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const handleError = (res, err) => {
  console.error('❌ Heritage route error:', err);

  // Mongoose validation errors
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.fromEntries(
        Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
      ),
    });
  }

  // Bad ObjectId casting
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  // Duplicate key (e.g., unique index)
  if (err?.code === 11000) {
    return res.status(409).json({
      message: 'Duplicate key',
      fields: err.keyValue || {},
    });
  }

  return res.status(500).json({ message: 'Internal Server Error' });
};

// =========================
// GET /api/heritage
// (kept intact, returns all)
// =========================
router.get('/', async (req, res) => {
  try {
    const heritageSites = await Heritage.find();
    res.status(200).json(heritageSites);
  } catch (err) {
    console.error('❌ Failed to fetch heritage sites:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// =====================================
// GET /api/heritage/:id  (fetch single)
// optional: ?populate=true to populate items
// =====================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { populate } = req.query;

    if (!isValidId(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    let query = Heritage.findById(id);
    if (populate === 'true') query = query.populate('items');

    const site = await query.exec();

    if (!site) return res.status(404).json({ message: 'Not found' });

    res.status(200).json(site);
  } catch (err) {
    handleError(res, err);
  }
});

// =====================================
// POST /api/heritage  (add/create)
// Body: JSON matching Heritage schema
// =====================================
router.post('/', async (req, res) => {
  try {
    const doc = new Heritage(req.body);
    const saved = await doc.save();
    res.status(201).json(saved);
  } catch (err) {
    handleError(res, err);
  }
});

// =====================================
// PUT /api/heritage/:id   (edit/replace)
// PATCH /api/heritage/:id (edit/partial)
// =====================================
const updateHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const updated = await Heritage.findByIdAndUpdate(id, req.body, {
      new: true,          // return updated doc
      runValidators: true // honor schema validators on update
    });

    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(updated);
  } catch (err) {
    handleError(res, err);
  }
};

router.put('/:id', updateHandler);
router.patch('/:id', updateHandler);

// ============================================
// POST /api/heritage/:id/items
// Add one or more item ObjectIds to the heritage.
// Body: { itemId: "<id>" } OR { items: ["id1","id2"] }
// Uses $addToSet to avoid duplicates. Returns updated doc.
// Optional query param ?populate=true to populate items
// ============================================
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid heritage ID' });

    // support single itemId or array of items
    const { itemId, items } = req.body;
    let toAdd = [];

    if (itemId) {
      if (!isValidId(itemId)) return res.status(400).json({ message: 'Invalid itemId' });
      toAdd = [itemId];
    } else if (Array.isArray(items)) {
      // validate each id
      for (const it of items) {
        if (!isValidId(it)) return res.status(400).json({ message: `Invalid item id: ${it}` });
      }
      toAdd = items;
    } else {
      return res.status(400).json({ message: 'Provide itemId or items array in body' });
    }

    // Optional: verify items actually exist (recommended)
    const missing = [];
    try {
      const found = await Item.find({ _id: { $in: toAdd } }).select('_id').lean();
      const foundIds = new Set(found.map((d) => String(d._id)));
      for (const idStr of toAdd) {
        if (!foundIds.has(String(idStr))) missing.push(idStr);
      }
    } catch (err) {
      // If Item model not available or query fails, we proceed without existence check.
      console.warn('⚠️ Item existence check skipped or failed:', err);
    }

    if (missing.length) {
      return res.status(404).json({ message: 'Some items not found', missing });
    }

    // build $addToSet update (add each element)
    const addSet = toAdd.reduce((acc, cur) => {
      acc.$each.push(mongoose.Types.ObjectId(cur));
      return acc;
    }, { $each: [] });

    const updated = await Heritage.findByIdAndUpdate(
      id,
      { $addToSet: { items: addSet } },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Heritage not found' });

    // optionally populate items
    const { populate } = req.query;
    const result = populate === 'true' ? await updated.populate('items').execPopulate() : updated;

    res.status(200).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ===================================================
// DELETE /api/heritage/:id/items/:itemId
// Remove a single item from heritage.items
// ===================================================
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid heritage ID' });
    if (!isValidId(itemId)) return res.status(400).json({ message: 'Invalid item ID' });

    const updated = await Heritage.findByIdAndUpdate(
      id,
      { $pull: { items: mongoose.Types.ObjectId(itemId) } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Heritage not found' });

    res.status(200).json({ message: 'Item removed', heritage: updated });
  } catch (err) {
    handleError(res, err);
  }
});

// ===================================================
// DELETE /api/heritage/:id/items
// Remove multiple items by body { items: ["id1","id2"] }
// ===================================================
router.delete('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid heritage ID' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Provide items array in body' });

    for (const it of items) {
      if (!isValidId(it)) return res.status(400).json({ message: `Invalid item id: ${it}` });
    }

    const objectIds = items.map((it) => mongoose.Types.ObjectId(it));

    const updated = await Heritage.findByIdAndUpdate(
      id,
      { $pull: { items: { $in: objectIds } } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Heritage not found' });

    res.status(200).json({ message: 'Items removed', heritage: updated });
  } catch (err) {
    handleError(res, err);
  }
});

// ================================
// DELETE /api/heritage/:id (delete)
// ================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const deleted = await Heritage.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Not found' });

    res.status(200).json({ message: 'Deleted successfully', id });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
