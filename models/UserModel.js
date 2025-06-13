

const db = require('../config/db');  // PostgreSQL connection

const UserModel = {
  // Get user by email
  getUserByEmail: async (email) => {
    try {
      const query = 'SELECT * FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1';
      const { rows } = await db.query(query, [email]);
      return rows[0] || null;  // Return null if no user found
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw new Error('Error fetching user by email');
    }
  },

  // Get user by username
  getUserByUsername: async (username) => {
    try {
      const query = 'SELECT * FROM "user" WHERE username = $1 LIMIT 1';
      const { rows } = await db.query(query, [username]);
      return rows[0] || null;  // Return null if no user found
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw new Error('Error fetching user by username');
    }
  },

  // Update user status (online/offline)
  updateStatus: async (uid, status) => {
    try {
      const query = 'UPDATE "user" SET status = $1 WHERE uid = $2 RETURNING *';
      const { rows } = await db.query(query, [status, uid]);
      return rows[0];  // Return the updated user object
    } catch (error) {
      console.error('Error updating user status:', error);
      throw new Error('Error updating user status');
    }
  },

  // Create a new user
  createUser: async (user) => {
    try {
      const query = `
        INSERT INTO "user" (uid, email, username, role, status, created_at, password)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const values = [
        user.uid,
        user.email,
        user.username,
        user.role,
        user.status,
        user.created_at,
        user.password,
        // user.verified,
      ];
      const { rows } = await db.query(query, values);
      return rows[0];  // Return the newly created user
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Error creating user');
    }
  },

  // Update last login timestamp
  updateLastLogin: async (uid) => {
    try {
      const query = 'UPDATE "user" SET last_login = NOW() WHERE uid = $1';
      await db.query(query, [uid]);
    } catch (error) {
      console.error('Error updating last login:', error);
      throw new Error('Error updating last login');
    }
  },
    // Ensure you have a method that gets the user by ID
getUserById: async (uid) => {
    try {
      const query = 'SELECT * FROM "user" WHERE uid = $1 LIMIT 1';
      const { rows } = await db.query(query, [uid]);
      return rows[0] || null;  // Return the user or null if not found
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw new Error('Error fetching user by ID');
    }
  },



};


module.exports = UserModel;
