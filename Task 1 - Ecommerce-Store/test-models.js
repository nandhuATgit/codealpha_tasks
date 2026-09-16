/**
 * Database Models Verification Script
 * Tests validation rules, schema creation, and relationships (.populate())
 *
 * Run with: node test-models.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';

async function testDatabaseModels() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Create a Test User
    console.log('\n--- 1. Testing User Model ---');
    const testEmail = `teststudent_${Date.now()}@college.edu`;
    const user = await User.create({
      name: 'Test Student',
      email: testEmail,
      password: 'hashed_sample_password_123', // In real auth, bcryptjs will hash this
      role: 'user',
    });
    console.log('✅ User created successfully:');
    console.log({ id: user._id, name: user.name, email: user.email, role: user.role });

    // 2. Create a Test Product
    console.log('\n--- 2. Testing Product Model ---');
    const product = await Product.create({
      name: 'Wireless Ergonomic Mouse',
      description: 'Rechargeable wireless mouse for long coding sessions.',
      price: 24.99,
      category: 'electronics',
      stock: 50,
    });
    console.log('✅ Product created successfully:');
    console.log({ id: product._id, name: product.name, price: product.price, stock: product.stock });

    // 3. Create a Test Order (Linking User + Product)
    console.log('\n--- 3. Testing Order Model & Relationships ---');
    const order = await Order.create({
      user: user._id, // Reference to User._id
      products: [
        {
          product: product._id, // Reference to Product._id
          name: product.name,
          quantity: 2,
          price: product.price,
        },
      ],
      totalAmount: product.price * 2,
      shippingAddress: {
        fullName: 'Test Student',
        address: 'Hostel Block C, Room 301',
        city: 'Hyderabad',
        postalCode: '500032',
        country: 'India',
      },
      paymentMethod: 'COD',
      status: 'Pending',
    });
    console.log('✅ Order created successfully with ID:', order._id);

    // 4. Test Population (Joining collections like a SQL JOIN)
    console.log('\n--- 4. Testing Mongoose Population (Foreign Key Joins) ---');
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email role')
      .populate('products.product', 'name category stock');

    console.log('✅ Populated Order Data:');
    console.dir(populatedOrder.toObject(), { depth: null });

    // 5. Cleanup test data
    console.log('\n--- 5. Cleaning Up Test Documents ---');
    await Order.findByIdAndDelete(order._id);
    await Product.findByIdAndDelete(product._id);
    await User.findByIdAndDelete(user._id);
    console.log('✅ Test documents cleaned up cleanly.');

    console.log('\n🎉 ALL MODEL TESTS AND RELATIONSHIPS PASSED!\n');
  } catch (error) {
    console.error('\n❌ Model Test Error:', error.message);
    if (error.errors) {
      console.error('Validation Details:', Object.keys(error.errors).map((key) => error.errors[key].message));
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

testDatabaseModels();
