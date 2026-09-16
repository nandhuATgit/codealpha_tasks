const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'college_project_super_secret_jwt_key_2026';

/**
 * Helper function to generate signed JWT Token
 * @param {Object} user - User document
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valid for 7 days
  );
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Basic Field Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, and password.',
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long.',
      });
    }

    // 2. Email Format Validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // 3. Password Strength Validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 4. Confirm Password Match (if passed from client)
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 5. Prevent Duplicate Email Registration
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    // 6. Hash Password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 7. Create and Save User in MongoDB
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
    });

    // 8. Generate JWT Token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Mongoose schema validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again later.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate Input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check if User Exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password. Please check your credentials.',
      });
    }

    // 3. Compare Password using bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password. Please check your credentials.',
      });
    }

    // 4. Generate JWT Token
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again later.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private (Requires valid JWT via authMiddleware)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user is set by authMiddleware
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user profile.',
      error: error.message,
    });
  }
});

module.exports = router;
