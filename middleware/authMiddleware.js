// const jwt = require('jsonwebtoken');

// // Middleware to verify JWT token and check if user is authenticated
// const verifyToken = (req, res, next) => {
//   const token = req.header('x-auth-token');  // Token should be passed in the `x-auth-token` header
  
//   if (!token) {
//     console.error('Token not found in request headers.');
//     return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
//   }

//   try {
//     // Verify the token using the JWT_SECRET from the environment variables
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Attach the decoded user info to the request object
//     req.user = decoded;
//     console.log('Token successfully verified for user:', decoded.uid);  // Log the user ID for debugging
    
//     next();  // Allow the request to proceed
//   } catch (error) {
//     console.error('Token verification failed:', error.message);
//     res.status(400).json({ success: false, message: 'Invalid or expired token.' });
//   }
// };

// // Middleware to verify if the user has an 'admin' role
// const verifyAdmin = (req, res, next) => {
//   // Check if the user role is 'admin'
//   if (req.user && req.user.role === 'admin') {
//     console.log('User is an admin, proceeding to the next middleware.');
//     return next();  // Proceed to the next middleware if the user is an admin
//   }
  
//   console.error('Access denied. Admins only. User role:', req.user ? req.user.role : 'Unknown');
//   return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
// };

// module.exports = { verifyToken, verifyAdmin };


const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role }; // Attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
