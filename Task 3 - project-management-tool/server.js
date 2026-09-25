require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Centralized 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route ${req.originalUrl} not found.`
  });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error.'
  });
});

// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI === 'your_mongodb_atlas_connection_string') {
  console.warn('\n============================================================');
  console.warn('⚠️  WARNING: MONGO_URI is not configured in your .env file!');
  console.warn('Please update .env with your MongoDB Atlas connection string.');
  console.warn('Example: MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/project_management');
  console.warn('============================================================\n');
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB successfully.');
    })
    .catch((err) => {
      console.error('\n❌ MongoDB Connection Error:', err.message);
      console.error('Please check your MONGO_URI, network connection, and Atlas IP whitelist (0.0.0.0/0).\n');
    });
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Project Management Tool server is running on http://localhost:${PORT}`);
});

module.exports = app;
