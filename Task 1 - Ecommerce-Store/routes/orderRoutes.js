const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

/**
 * All order routes require a valid JWT token
 */
router.use(authMiddleware);

/**
 * @route   POST /api/orders
 * @desc    Create and place a new order
 * @access  Private (Authenticated users only)
 */
router.post('/', async (req, res) => {
  try {
    const { products, shippingAddress, paymentMethod } = req.body;

    // 1. Validate Products Array
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your order must contain at least one product.',
      });
    }

    // 2. Validate Shipping Address Fields
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required.',
      });
    }

    const { fullName, phone, address, city, postalCode } = shippingAddress;
    if (!fullName || !phone || !address || !city || !postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all shipping details: name, phone, address, city, and PIN code.',
      });
    }

    // 3. Process products, check stock, and calculate total on server
    let serverCalculatedTotal = 0;
    const validatedOrderItems = [];
    const productsToUpdate = [];

    for (const item of products) {
      const productId = item.product || item.id || item._id;

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid product ID provided: ${productId}`,
        });
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${productId}. Must be at least 1.`,
        });
      }

      // Fetch fresh product document from database to get authoritative price and stock
      const dbProduct = await Product.findById(productId);
      if (!dbProduct) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${productId} was not found in our catalog.`,
        });
      }

      // Verify sufficient stock
      if (dbProduct.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory for "${dbProduct.name}". Only ${dbProduct.stock} units available (requested ${quantity}).`,
        });
      }

      // Calculate server price snapshot
      const itemSubtotal = dbProduct.price * quantity;
      serverCalculatedTotal += itemSubtotal;

      validatedOrderItems.push({
        product: dbProduct._id,
        name: dbProduct.name,
        quantity: quantity,
        price: dbProduct.price,
      });

      productsToUpdate.push({
        productId: dbProduct._id,
        quantityToDeduct: quantity,
      });
    }

    // Round total to 2 decimal places
    const finalTotal = Math.round(serverCalculatedTotal * 100) / 100;

    // 4. Reduce Product Stock in database
    for (const update of productsToUpdate) {
      await Product.findByIdAndUpdate(update.productId, {
        $inc: { stock: -update.quantityToDeduct },
      });
    }

    // 5. Create Order Document in MongoDB
    const newOrder = await Order.create({
      user: req.user.id,
      products: validatedOrderItems,
      totalAmount: finalTotal,
      shippingAddress: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: shippingAddress.country ? shippingAddress.country.trim() : 'India',
      },
      paymentMethod: paymentMethod === 'COD' || !paymentMethod ? 'COD' : paymentMethod,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! Cash on Delivery confirmed.',
      order: newOrder,
    });
  } catch (error) {
    console.error('Error placing order:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while processing your order.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/orders
 * @desc    Get all orders belonging to the logged-in user
 * @access  Private (User can only view their own orders)
 */
router.get('/', async (req, res) => {
  try {
    // Only return orders belonging to the authenticated user
    const orders = await Order.find({ user: req.user.id })
      .populate('products.product', 'name image price category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving your orders.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order by ID
 * @access  Private (Users can only view their own order)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format.',
      });
    }

    const order = await Order.findById(id).populate('products.product', 'name image price category');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Security Check: Users should only be able to view their own orders
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are only authorized to view your own orders.',
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error(`Error fetching order ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving order details.',
      error: error.message,
    });
  }
});

module.exports = router;
