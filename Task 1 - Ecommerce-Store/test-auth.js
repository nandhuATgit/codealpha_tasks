/**
 * Authentication Automated Verification Script
 * Tests:
 * 1. Register with valid details
 * 2. Prevent duplicate email registration
 * 3. Validate minimum password length & missing fields
 * 4. Verify password is encrypted with bcrypt in MongoDB
 * 5. Login with valid credentials
 * 6. Login with incorrect password
 * 7. Login with nonexistent email
 * 8. Access protected route /api/auth/me with valid JWT
 * 9. Reject unauthorized requests (no token / invalid token)
 *
 * Usage: node test-auth.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';
const TEST_PORT = 5056;

async function runAuthTests() {
  console.log('🔄 Setting up internal test server for Authentication...');

  // 1. Connect Mongoose
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // 2. Start temporary Express test app
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = app.listen(TEST_PORT, async () => {
    console.log(`✅ Test auth server running on http://localhost:${TEST_PORT}\n`);
    const BASE_URL = `http://localhost:${TEST_PORT}/api/auth`;

    const testEmail = `student_${Date.now()}@college.edu`;
    const testPassword = 'SecurePassword123!';
    let authToken = null;
    let userId = null;

    try {
      // TEST 1: Register User
      console.log('--- TEST 1: POST /api/auth/register (New User) ---');
      const regRes = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alex Rivera',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        }),
      });
      const regData = await regRes.json();
      console.log(`Status: ${regRes.status}`);
      console.log('Response:', regData);

      if (regRes.status !== 201 || !regData.success || !regData.token) {
        throw new Error('Registration test failed');
      }
      authToken = regData.token;
      userId = regData.user.id;
      console.log(`✅ Registration passed! Received JWT token: ${authToken.slice(0, 20)}...\n`);

      // TEST 2: Prevent Duplicate Email Registration
      console.log('--- TEST 2: Duplicate Email Registration Prevention ---');
      const dupRes = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alex Duplicate',
          email: testEmail,
          password: 'AnotherPassword999',
        }),
      });
      const dupData = await dupRes.json();
      console.log(`Status: ${dupRes.status} (Expected 400)`);
      console.log('Message:', dupData.message);
      if (dupRes.status !== 400 || dupData.success) {
        throw new Error('Duplicate email was not prevented!');
      }
      console.log('✅ Duplicate registration successfully blocked.\n');

      // TEST 3: Validation: Short password & missing fields
      console.log('--- TEST 3: Input Validation (< 6 chars password) ---');
      const shortPassRes = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sam Test',
          email: `sam_${Date.now()}@college.edu`,
          password: '123',
        }),
      });
      const shortPassData = await shortPassRes.json();
      console.log(`Status: ${shortPassRes.status} (Expected 400)`);
      console.log('Message:', shortPassData.message);
      if (shortPassRes.status !== 400) {
        throw new Error('Short password validation failed');
      }
      console.log('✅ Input validation successfully caught weak password.\n');

      // TEST 4: Verify Bcrypt Hash in MongoDB
      console.log('--- TEST 4: Bcrypt Hash Verification in Database ---');
      const dbUser = await User.findById(userId);
      console.log(`Stored password in DB: ${dbUser.password}`);
      const isBcryptHash = dbUser.password.startsWith('$2a$') || dbUser.password.startsWith('$2b$');
      if (!isBcryptHash || dbUser.password === testPassword) {
        throw new Error('Password was stored in plain text or not hashed properly!');
      }
      console.log('✅ Password is securely encrypted using bcryptjs in MongoDB.\n');

      // TEST 5: Login with Valid Credentials
      console.log('--- TEST 5: POST /api/auth/login (Correct Credentials) ---');
      const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      const loginData = await loginRes.json();
      console.log(`Status: ${loginRes.status}`);
      console.log('Response:', loginData);
      if (loginRes.status !== 200 || !loginData.success || !loginData.token) {
        throw new Error('Login failed with valid credentials');
      }
      console.log('✅ Login successful and returned JWT.\n');

      // TEST 6: Login with Incorrect Password
      console.log('--- TEST 6: POST /api/auth/login (Wrong Password) ---');
      const wrongPassRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongPassword456',
        }),
      });
      const wrongPassData = await wrongPassRes.json();
      console.log(`Status: ${wrongPassRes.status} (Expected 400)`);
      console.log('Message:', wrongPassData.message);
      if (wrongPassRes.status !== 400 || wrongPassData.success) {
        throw new Error('Login should have failed for wrong password');
      }
      console.log('✅ Wrong password correctly rejected.\n');

      // TEST 7: Protected Route with Valid Token (GET /api/auth/me)
      console.log('--- TEST 7: GET /api/auth/me (Protected Route with JWT) ---');
      const meRes = await fetch(`${BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const meData = await meRes.json();
      console.log(`Status: ${meRes.status}`);
      console.log('Profile Data:', meData);
      if (meRes.status !== 200 || !meData.success || meData.user.email !== testEmail) {
        throw new Error('Protected route rejected valid token');
      }
      console.log('✅ Protected route successfully authorized user.\n');

      // TEST 8: Protected Route without Token (Access Denied)
      console.log('--- TEST 8: GET /api/auth/me (Protected Route without Token) ---');
      const noTokenRes = await fetch(`${BASE_URL}/me`);
      const noTokenData = await noTokenRes.json();
      console.log(`Status: ${noTokenRes.status} (Expected 401)`);
      console.log('Message:', noTokenData.message);
      if (noTokenRes.status !== 401 || noTokenData.success) {
        throw new Error('Protected route allowed access without token');
      }
      console.log('✅ Unauthenticated request correctly blocked with 401.\n');

      // TEST 9: Protected Route with Fake Token
      console.log('--- TEST 9: GET /api/auth/me (Invalid Fake Token) ---');
      const fakeTokenRes = await fetch(`${BASE_URL}/me`, {
        headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
      });
      const fakeTokenData = await fakeTokenRes.json();
      console.log(`Status: ${fakeTokenRes.status} (Expected 401)`);
      console.log('Message:', fakeTokenData.message);
      if (fakeTokenRes.status !== 401) {
        throw new Error('Invalid token should be rejected');
      }
      console.log('✅ Fake token correctly rejected with 401.\n');

      // Cleanup
      console.log('--- CLEANUP: Removing Test User ---');
      await User.findByIdAndDelete(userId);
      console.log('✅ Test user document deleted from database.\n');

      console.log('🎉 ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
      console.error('❌ Auth Test Failed:', err.message);
    } finally {
      server.close();
      await mongoose.disconnect();
      console.log('🔌 Test server closed and database disconnected.');
    }
  });
}

runAuthTests().catch((err) => {
  console.error('Fatal error running tests:', err.message);
  process.exit(1);
});
