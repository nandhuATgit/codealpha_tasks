const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';

// ==========================================
// Middleware Configuration
// ==========================================

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Parse URL-encoded bodies (form data)
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Database Connection (MongoDB via Mongoose)
// ==========================================
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('ℹ️  Tip: Make sure MongoDB service is running locally or check your MONGODB_URI in .env');
  });

// ==========================================
// API Routes
// ==========================================

// Mount Modular Authentication Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Mount Modular Product Routes
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// Mount Modular Order Routes
const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

// Basic Test API endpoint to verify backend connectivity
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running smoothly!',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint reporting database status
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
  };

  res.status(200).json({
    status: 'online',
    database: states[dbState] || 'Unknown',
    uptime: `${Math.floor(process.uptime())} seconds`,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// Start the Express Server
// ==========================================
app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
  console.log(`🔌 Test API available at: http://localhost:${PORT}/api/test`);
  console.log(`🩺 Health API available at: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Auth API available at: http://localhost:${PORT}/api/auth`);
  console.log(`📦 Product API available at: http://localhost:${PORT}/api/products`);
  console.log(`🛍️  Orders API available at: http://localhost:${PORT}/api/orders`);
  console.log('==================================================');
});
