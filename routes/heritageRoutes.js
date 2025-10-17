// const express = require('express');
// const router = express.Router();
// const Heritage = require('../models/Heritage'); // correct path assumed

// // GET /api/heritage
// router.get('/', async (req, res) => {
//   try {
//     const heritageSites = await Heritage.find();
//     res.status(200).json(heritageSites);
//   } catch (err) {
//     console.error("❌ Failed to fetch heritage sites:", err);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Heritage = require('../models/Heritage'); // correct path assumed

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
// =====================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const site = await Heritage.findById(id);
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
