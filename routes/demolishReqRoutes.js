const express = require('express');
const multer = require('multer');
const path = require('path');
const { createDemolitionRequest } = require('../models/demolishReqModel');

const router = express.Router();

// File upload setup
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// @route   POST /api/demolish
// @desc    Create a demolition request
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const {
      user_id,
      contact,
      description,
      price,
      status,
      location,
    } = req.body;

    const image_name = req.file ? req.file.filename : null;

    const newRequest = await createDemolitionRequest({
      user_id,
      contact,
      description,
      image_name,
      price,
      status,
      location,
    });

    res.status(201).json({
      success: true,
      message: 'Demolition request submitted',
      data: newRequest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
