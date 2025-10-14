const NodeGeocoder = require('node-geocoder');

const options = {
  provider: process.env.GEOCODER_PROVIDER || 'openstreetmap', // Using OpenStreetMap as default (free)
  apiKey: process.env.GEOCODER_API_KEY, // Optional, not needed for OpenStreetMap
  formatter: null
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;