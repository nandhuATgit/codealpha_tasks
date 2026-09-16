const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');

/**
 * @route   GET /api/products
 * @desc    Get all products (with optional filtering by category & search keyword)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    // Filter by category if provided
    if (category && category.trim() !== '') {
      query.category = category.trim().toLowerCase();
    }

    // Search by product name or description
    if (search && search.trim() !== '') {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product details',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Public (Will be protected with Admin auth in future)
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, price, image, category, stock } = req.body;

    // Create product instance (Mongoose model validates required fields)
    const product = await Product.create({
      name,
      description,
      price,
      image,
      category,
      stock,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating product',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update an existing product
 * @access  Public (Will be protected with Admin auth in future)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true, // Return updated document
      runValidators: true, // Run schema validators on update
    });

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error(`Error updating product ${req.params.id}:`, error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating product',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Public (Will be protected with Admin auth in future)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error(`Error deleting product ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product',
      error: error.message,
    });
  }
});

module.exports = router;
