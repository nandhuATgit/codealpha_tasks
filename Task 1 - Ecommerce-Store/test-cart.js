/**
 * Automated Unit Tests for Shopping Cart Operations
 * Tests:
 * 1. Add product to cart
 * 2. Duplicate product adds to quantity instead of creating duplicate entry
 * 3. Add distinct product
 * 4. Increase quantity
 * 5. Decrease quantity
 * 6. Decrease quantity to 0 removes product
 * 7. Explicit product removal
 * 8. Subtotal calculation
 * 9. Total calculation
 * 10. Total item count calculation
 * 11. Clear cart
 * 12. LocalStorage persistence
 *
 * Usage: node test-cart.js
 */

// Setup Mock Browser Environment for Node.js
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.window = {
  dispatchEvent: () => {},
};

global.document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  body: { appendChild: () => {} },
  createElement: () => ({ setAttribute: () => {}, classList: { add: () => {}, remove: () => {} }, appendChild: () => {} })
};

global.CustomEvent = class CustomEvent {};

// Load Cart Module
const Cart = require('./public/js/cart.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

function runCartTests() {
  console.log('🧪 Starting Shopping Cart Unit Tests...\n');

  // Clear before testing
  Cart.clear();
  assert(Cart.getItems().length === 0, 'Cart starts empty');
  assert(Cart.getItemCount() === 0, 'Initial item count is 0');
  assert(Cart.getSubtotal() === 0, 'Initial subtotal is 0.00');

  // Test 1: Add product to cart
  const laptopStand = {
    _id: 'prod_001',
    name: 'Ergonomic Laptop Stand',
    price: 29.99,
    category: 'electronics',
    stock: 20
  };

  Cart.addItem(laptopStand, 1);
  let items = Cart.getItems();
  assert(items.length === 1, 'Item added to cart (items.length === 1)');
  assert(items[0].id === 'prod_001', 'Item ID preserved correctly');
  assert(items[0].quantity === 1, 'Item initial quantity is 1');
  assert(Cart.getItemCount() === 1, 'Navbar item count is 1');
  assert(Cart.getSubtotal() === 29.99, 'Subtotal is 29.99');

  // Test 2: Duplicate product increases quantity (CRITICAL REQUIREMENT)
  console.log('\n--- Testing Duplicate Product Handling ---');
  Cart.addItem(laptopStand, 2);
  items = Cart.getItems();
  assert(items.length === 1, 'Duplicate product did NOT create a new entry (still 1 entry in cart)');
  assert(items[0].quantity === 3, 'Duplicate product increased quantity (1 + 2 = 3)');
  assert(Cart.getItemCount() === 3, 'Navbar count reflects total quantity (3 items)');
  assert(Cart.getSubtotal() === 89.97, 'Subtotal correctly calculated for 3 units ($89.97)');

  // Test 3: Add second distinct product
  console.log('\n--- Testing Multiple Products in Cart ---');
  const mouse = {
    _id: 'prod_002',
    name: 'Precision Wireless Mouse',
    price: 15.00,
    category: 'electronics',
    stock: 10
  };

  Cart.addItem(mouse, 2);
  items = Cart.getItems();
  assert(items.length === 2, 'Distinct product added (now 2 distinct entries in cart)');
  assert(Cart.getItemCount() === 5, 'Total item count is 5 (3 stands + 2 mice)');
  assert(Cart.getSubtotal() === 119.97, 'Subtotal reflects both items: 89.97 + (2 * 15.00) = 119.97');
  assert(Cart.getTotal() === 119.97, 'Total matches subtotal ($119.97)');

  // Test 4: Increase quantity
  console.log('\n--- Testing Increase Quantity ---');
  Cart.increaseQuantity('prod_002', 1);
  items = Cart.getItems();
  const mouseItem = items.find(i => i.id === 'prod_002');
  assert(mouseItem.quantity === 3, 'Mouse quantity increased from 2 to 3');
  assert(Cart.getItemCount() === 6, 'Total item count increased to 6');

  // Test 5: Decrease quantity
  console.log('\n--- Testing Decrease Quantity ---');
  Cart.decreaseQuantity('prod_002', 1);
  items = Cart.getItems();
  const mouseItemAfterDec = items.find(i => i.id === 'prod_002');
  assert(mouseItemAfterDec.quantity === 2, 'Mouse quantity decreased from 3 to 2');

  // Test 6: Decrease quantity to 0 removes item
  console.log('\n--- Testing Decrease to 0 auto-removes item ---');
  Cart.decreaseQuantity('prod_002', 2);
  items = Cart.getItems();
  assert(items.length === 1, 'Item removed when quantity reached 0 (length is 1)');
  assert(items.find(i => i.id === 'prod_002') === undefined, 'prod_002 is no longer in cart');

  // Test 7: Explicit removal
  console.log('\n--- Testing Explicit Removal ---');
  Cart.removeItem('prod_001');
  items = Cart.getItems();
  assert(items.length === 0, 'Item explicitly removed via removeItem()');
  assert(Cart.getItemCount() === 0, 'Cart item count is 0');
  assert(Cart.getSubtotal() === 0, 'Subtotal is 0');

  // Test 8: Persistence verification in localStorage
  console.log('\n--- Testing LocalStorage Persistence ---');
  Cart.addItem(laptopStand, 1);
  const rawStorage = mockStorage['college_store_cart'];
  assert(rawStorage !== undefined && rawStorage !== null, 'Cart string persisted in localStorage');
  const parsed = JSON.parse(rawStorage);
  assert(parsed.length === 1 && parsed[0].name === 'Ergonomic Laptop Stand', 'LocalStorage contains accurate serialized cart');

  // Test 9: Clear cart
  console.log('\n--- Testing Clear Cart ---');
  Cart.clear();
  assert(Cart.getItems().length === 0, 'Cart successfully cleared via clear()');
  assert(Cart.getItemCount() === 0, 'Item count reset to 0');

  console.log('\n🎉 ALL 12 CART UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runCartTests();
