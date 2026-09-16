/**
 * Automated Verification Script for Order Processing & Checkout
 *
 * Tests:
 * 1. Reject unauthenticated order placement (401)
 * 2. Place order with valid JWT, shipping details, and products
 * 3. Verify server calculates exact total from database prices
 * 4. Verify stock reduction in MongoDB
 * 5. Block order placement if stock is insufficient (400)
 * 6. Retrieve user orders (GET /api/orders) - user sees only their own orders
 * 7. Privacy check: User B cannot access User A's order by ID (403 Forbidden)
 * 8. Cleanup test data
 *
 * Usage: node test-orders.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';
const JWT_SECRET = process.env.JWT_SECRET || 'college_project_super_secret_jwt_key_2026';
const TEST_PORT = 5057;

function makeToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function runOrderTests() {
  console.log('🔄 Setting up internal test server for Orders & Checkout...');

  // 1. Connect Mongoose
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // 2. Start Express app
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);

  const server = app.listen(TEST_PORT, async () => {
    console.log(`✅ Test server running on http://localhost:${TEST_PORT}\n`);
    const BASE_URL = `http://localhost:${TEST_PORT}/api/orders`;

    let userA, userB, tokenA, tokenB, testProduct, orderAId;

    try {
      // Setup User A
      userA = await User.create({
        name: 'Student A',
        email: `student_a_${Date.now()}@college.edu`,
        password: '$2a$10$hashedpasswordforstudentA',
        role: 'user',
      });
      tokenA = makeToken(userA);

      // Setup User B
      userB = await User.create({
        name: 'Student B',
        email: `student_b_${Date.now()}@college.edu`,
        password: '$2a$10$hashedpasswordforstudentB',
        role: 'user',
      });
      tokenB = makeToken(userB);

      // Setup Test Product with Initial Stock = 10
      testProduct = await Product.create({
        name: 'Order Test Campus Hoodie',
        description: 'Warm fleece hoodie for campus winter.',
        price: 35.0,
        category: 'lifestyle',
        stock: 10,
      });
      console.log(`📦 Created Test Product "${testProduct.name}" (Stock: ${testProduct.stock}, Price: $${testProduct.price})\n`);

      // TEST 1: Reject unauthenticated order placement
      console.log('--- TEST 1: POST /api/orders without Token (Expected 401) ---');
      const noAuthRes = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{ product: testProduct._id, quantity: 1 }],
          shippingAddress: {
            fullName: 'Student A',
            phone: '9876543210',
            address: 'Hostel A',
            city: 'Bangalore',
            postalCode: '560001',
          },
        }),
      });
      const noAuthData = await noAuthRes.json();
      console.log(`Status: ${noAuthRes.status}, Message: ${noAuthData.message}`);
      if (noAuthRes.status !== 401) {
        throw new Error('Unauthenticated order was not blocked!');
      }
      console.log('✅ Unauthenticated order blocked.\n');

      // TEST 2: Place valid order with 3 units
      console.log('--- TEST 2: POST /api/orders with Valid JWT (Place Order) ---');
      const placeRes = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          products: [{ product: testProduct._id, quantity: 3 }],
          shippingAddress: {
            fullName: 'Student A',
            phone: '9876543210',
            address: 'Hostel Block 4, Room 102',
            city: 'Bangalore',
            postalCode: '560001',
          },
          paymentMethod: 'COD',
        }),
      });
      const placeData = await placeRes.json();
      console.log(`Status: ${placeRes.status}`);
      console.log('Order Details:', {
        orderId: placeData.order?._id,
        totalAmount: placeData.order?.totalAmount,
        paymentMethod: placeData.order?.paymentMethod,
        status: placeData.order?.status,
      });

      if (placeRes.status !== 201 || !placeData.success) {
        throw new Error('Failed to place valid order');
      }
      orderAId = placeData.order._id;

      // TEST 3: Verify server calculated exact total (3 units * $35 = $105)
      console.log('\n--- TEST 3: Server-side Total Calculation ---');
      if (placeData.order.totalAmount !== 105.0) {
        throw new Error(`Total was ${placeData.order.totalAmount}, expected 105.00`);
      }
      console.log(`✅ Exact total calculated on server: $${placeData.order.totalAmount.toFixed(2)}\n`);

      // TEST 4: Verify stock deduction in MongoDB (10 - 3 = 7)
      console.log('--- TEST 4: Stock Reduction in Database ---');
      const updatedProduct = await Product.findById(testProduct._id);
      console.log(`Previous Stock: 10 -> Current Stock: ${updatedProduct.stock}`);
      if (updatedProduct.stock !== 7) {
        throw new Error(`Product stock was not deducted properly! Current stock is ${updatedProduct.stock}, expected 7`);
      }
      console.log('✅ Stock successfully reduced by 3 in MongoDB.\n');

      // TEST 5: Insufficient stock prevention (try ordering 10 units when only 7 left)
      console.log('--- TEST 5: Insufficient Stock Handling ---');
      const overOrderRes = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          products: [{ product: testProduct._id, quantity: 10 }],
          shippingAddress: {
            fullName: 'Student A',
            phone: '9876543210',
            address: 'Hostel Block 4, Room 102',
            city: 'Bangalore',
            postalCode: '560001',
          },
        }),
      });
      const overOrderData = await overOrderRes.json();
      console.log(`Status: ${overOrderRes.status} (Expected 400)`);
      console.log(`Message: ${overOrderData.message}`);
      if (overOrderRes.status !== 400) {
        throw new Error('Server did not prevent order exceeding available stock!');
      }
      console.log('✅ Order exceeding stock correctly rejected.\n');

      // TEST 6: User A retrieves their own orders (GET /api/orders)
      console.log('--- TEST 6: GET /api/orders (User A viewing their orders) ---');
      const userAOrdersRes = await fetch(BASE_URL, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const userAOrdersData = await userAOrdersRes.json();
      console.log(`User A Order Count: ${userAOrdersData.count}`);
      if (userAOrdersData.count < 1) {
        throw new Error('User A could not see their placed order');
      }
      console.log('✅ User A successfully viewed their orders.\n');

      // TEST 7: Privacy check - User B tries to view User A's order by ID (Expected 403 Forbidden)
      console.log('--- TEST 7: Security Privacy Check (User B accessing User A order) ---');
      const privacyRes = await fetch(`${BASE_URL}/${orderAId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const privacyData = await privacyRes.json();
      console.log(`Status: ${privacyRes.status} (Expected 403)`);
      console.log(`Message: ${privacyData.message}`);
      if (privacyRes.status !== 403) {
        throw new Error('User B was able to view User A order! Privacy check failed.');
      }
      console.log('✅ Access denied! Users cannot view orders placed by others.\n');

      console.log('🎉 ALL CHECKOUT & ORDER PROCESSING TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
      console.error('❌ Order Test Failed:', err.message);
    } finally {
      // Cleanup
      console.log('--- CLEANUP: Deleting Test Documents ---');
      if (orderAId) await Order.findByIdAndDelete(orderAId);
      if (testProduct) await Product.findByIdAndDelete(testProduct._id);
      if (userA) await User.findByIdAndDelete(userA._id);
      if (userB) await User.findByIdAndDelete(userB._id);
      console.log('✅ Cleanup complete.');

      server.close();
      await mongoose.disconnect();
      console.log('🔌 Test server closed and database disconnected.');
    }
  });
}

runOrderTests().catch((err) => {
  console.error('Fatal error running order tests:', err.message);
  process.exit(1);
});
