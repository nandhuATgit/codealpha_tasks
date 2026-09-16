const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be a negative value'],
    },
    image: {
      type: String,
      trim: true,
      default: 'https://placehold.co/400x400?text=Product+Image',
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      lowercase: true,
    },
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be a negative value'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer stock value',
      },
    },
  },
  {
    timestamps: true, // Automatically creates createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('Product', productSchema);
