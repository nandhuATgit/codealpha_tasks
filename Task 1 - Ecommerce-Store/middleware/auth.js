const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Protects private routes by verifying the JSON Web Token (JWT)
 * sent in the HTTP 'Authorization: Bearer <token>' header.
 */
module.exports = function authMiddleware(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.header('Authorization') || req.header('authorization');

  // Check if header is missing
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.',
    });
  }

  // Header should follow "Bearer <token>" format
  let token = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed authorization token.',
    });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'college_project_super_secret_jwt_key_2026';
    
    // Verify token validity and expiration
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach decoded user payload (id, name, email, role) to the request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token. Access denied.',
    });
  }
};
