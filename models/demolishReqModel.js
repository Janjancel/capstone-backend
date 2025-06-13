const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const createDemolitionRequest = async (data) => {
  const {
    user_id,
    contact,
    description,
    image_name,
    price,
    status = 'pending',
    location,
  } = data;

  const uid = uuidv4();
  const query = `
    INSERT INTO demolish_request (
      uid, user_id, contact, created_at, description,
      image_name, price, status, location
    )
    VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8)
    RETURNING uid
  `;
  const values = [
    uid, user_id, contact, description,
    image_name, parseFloat(price), status, location,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
  createDemolitionRequest,
};
