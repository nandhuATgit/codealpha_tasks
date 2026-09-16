const mongoose = require('mongoose');

// Sub-schema for individual items within an order
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name snapshot is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer quantity',
      },
      default: 1,
    },
    price: {
      type: Number,
      required: [true, 'Price snapshot at purchase time is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  { _id: false }
);

// Sub-schema for shipping address
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a registered user'],
    },
    products: {
      type: [orderItemSchema],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'An order must contain at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total order amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['COD', 'Card', 'UPI', 'NetBanking'],
        message: '{VALUE} is not a valid payment method',
      },
      default: 'COD',
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        message: '{VALUE} is not a valid order status',
      },
      default: 'Pending',
    },
  },
  {
    timestamps: true, // Automatically creates createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('Order', orderSchema);
