const express = require('express');
const router = express.Router();
const geocoder = require('../config/geocoder');

// Cache object to store geocoded addresses
const geocodeCache = new Map();

// Helper function to create cache key
const createCacheKey = (lat, lng) => `${lat},${lng}`;

// GET /api/geocode?lat=<latitude>&lng=<longitude>
router.get('/', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    // Validate parameters
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates. Please provide valid latitude and longitude.' 
      });
    }

    // Check cache first
    const cacheKey = createCacheKey(lat, lng);
    if (geocodeCache.has(cacheKey)) {
      return res.json({ address: geocodeCache.get(cacheKey) });
    }

    // Get address from coordinates
    const results = await geocoder.reverse({ lat, lon: lng });

    if (!results || results.length === 0) {
      return res.status(404).json({ 
        error: 'No address found for these coordinates.' 
      });
    }

    // Format the address
    const location = results[0];
    const address = location.formattedAddress || [
      location.streetName,
      location.city,
      location.state,
      location.country
    ].filter(Boolean).join(', ');

    // Cache the result (store for 24 hours)
    geocodeCache.set(cacheKey, address);
    setTimeout(() => geocodeCache.delete(cacheKey), 24 * 60 * 60 * 1000);

    res.json({ address });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ 
      error: 'Failed to get address from coordinates.' 
    });
  }
});

module.exports = router;