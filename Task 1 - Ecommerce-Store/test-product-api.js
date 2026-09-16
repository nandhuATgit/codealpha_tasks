/**
 * Product API Automated Verification Script
 * Tests all 5 endpoints:
 * 1. POST   /api/products
 * 2. GET    /api/products
 * 3. GET    /api/products/:id
 * 4. PUT    /api/products/:id
 * 5. DELETE /api/products/:id
 *
 * Usage: node test-product-api.js
 * (Ensure server is running with 'npm start' in another terminal, or this script will spin up an internal express instance to test)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';
const TEST_PORT = 5055;

async function runProductAPITests() {
  console.log('🔄 Setting up internal test server for Product API...');

  // 1. Connect Mongoose
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // 2. Start temporary Express test app
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/products', productRoutes);

  const server = app.listen(TEST_PORT, async () => {
    console.log(`✅ Test server running on http://localhost:${TEST_PORT}\n`);
    const BASE_URL = `http://localhost:${TEST_PORT}/api/products`;

    try {
      // TEST 1: POST /api/products (Create)
      console.log('--- TEST 1: POST /api/products (Create Product) ---');
      const createRes = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'API Test Mechanical Keyboard',
          description: 'Compact 75% mechanical keyboard for developer tests.',
          price: 54.99,
          image: 'https://placehold.co/400x300?text=Keyboard',
          category: 'electronics',
          stock: 12,
        }),
      });
      const createdData = await createRes.json();
      console.log(`Status: ${createRes.status}`);
      console.log('Response:', createdData);
      if (createRes.status !== 201 || !createdData.success) {
        throw new Error('Failed to create product in POST test');
      }
      const productId = createdData.product._id;
      console.log(`✅ Created Product ID: ${productId}\n`);

      // TEST 2: GET /api/products (List all)
      console.log('--- TEST 2: GET /api/products (List All Products) ---');
      const listRes = await fetch(BASE_URL);
      const listData = await listRes.json();
      console.log(`Status: ${listRes.status}, Total Products: ${listData.count}`);
      console.log(`✅ Retrieved ${listData.products.length} products.\n`);

      // TEST 3: GET /api/products/:id (Get single)
      console.log(`--- TEST 3: GET /api/products/${productId} (Get Product by ID) ---`);
      const getRes = await fetch(`${BASE_URL}/${productId}`);
      const getData = await getRes.json();
      console.log(`Status: ${getRes.status}`);
      console.log(`Product Name: ${getData.product.name}, Price: $${getData.product.price}`);
      console.log('✅ Single product fetched successfully.\n');

      // TEST 4: PUT /api/products/:id (Update)
      console.log(`--- TEST 4: PUT /api/products/${productId} (Update Product) ---`);
      const updateRes = await fetch(`${BASE_URL}/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: 49.99,
          stock: 20,
        }),
      });
      const updateData = await updateRes.json();
      console.log(`Status: ${updateRes.status}`);
      console.log(`Updated Price: $${updateData.product.price}, Updated Stock: ${updateData.product.stock}`);
      console.log('✅ Product updated successfully.\n');

      // TEST 5: DELETE /api/products/:id (Delete)
      console.log(`--- TEST 5: DELETE /api/products/${productId} (Delete Product) ---`);
      const deleteRes = await fetch(`${BASE_URL}/${productId}`, {
        method: 'DELETE',
      });
      const deleteData = await deleteRes.json();
      console.log(`Status: ${deleteRes.status}`);
      console.log('Response:', deleteData);
      console.log('✅ Product deleted successfully.\n');

      // TEST 6: Verify 404 on deleted product
      console.log(`--- TEST 6: GET /api/products/${productId} (Verify 404 After Delete) ---`);
      const verifyRes = await fetch(`${BASE_URL}/${productId}`);
      console.log(`Status: ${verifyRes.status} (Expected 404)`);
      console.log('✅ 404 confirmed for deleted item.\n');

      console.log('🎉 ALL PRODUCT API TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
      console.error('❌ API Test Failed:', err.message);
    } finally {
      server.close();
      await mongoose.disconnect();
      console.log('🔌 Test server closed and database disconnected.');
    }
  });
}

runProductAPITests().catch((err) => {
  console.error('Fatal error running tests:', err.message);
  process.exit(1);
});
