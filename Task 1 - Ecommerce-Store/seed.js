/**
 * Product Database Seeder
 * Populates MongoDB with 15 realistic sample products for testing and development.
 *
 * Usage: node seed.js  (or: npm run seed)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce_db';

const sampleProducts = [
  {
    name: 'Ergonomic Aluminium Laptop Stand',
    description: 'Adjustable folding laptop stand crafted with aviation-grade aluminium alloy. Enhances posture and cools your laptop during long coding sessions.',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80',
    category: 'electronics',
    stock: 25,
  },
  {
    name: 'Wireless Active Noise Cancelling Headphones',
    description: 'Crystal-clear sound with up to 35 hours of battery life and active noise cancellation. Perfect for focus in library and hostel environments.',
    price: 69.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    category: 'audio',
    stock: 18,
  },
  {
    name: 'RGB Mechanical Gaming & Coding Keyboard',
    description: 'Compact 75% layout with responsive tactile blue switches, programmable RGB backlighting, and durable PBT double-shot keycaps.',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80',
    category: 'electronics',
    stock: 14,
  },
  {
    name: 'Smart Water-Resistant Campus Backpack',
    description: 'Spacious 30L college backpack featuring a padded 15.6-inch laptop compartment, hidden anti-theft pockets, and external USB charging port.',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
    category: 'accessories',
    stock: 30,
  },
  {
    name: 'Data Structures & Algorithms Made Easy',
    description: 'Comprehensive DSA handbook covering fundamental data structures, graph algorithms, dynamic programming, and technical interview preparation.',
    price: 24.50,
    image: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80',
    category: 'books',
    stock: 45,
  },
  {
    name: 'Precision Wireless Optical Mouse',
    description: 'Silent-click ergonomic wireless mouse with adjustable DPI settings (800/1200/1600) and ultra-long 12-month battery life.',
    price: 15.99,
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=600&q=80',
    category: 'electronics',
    stock: 40,
  },
  {
    name: 'Stainless Steel Insulated Coffee Tumbler',
    description: 'Double-wall vacuum insulated mug keeps coffee piping hot for 8 hours or iced drinks cold for 18 hours. Leak-resistant flip lid.',
    price: 18.00,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    category: 'lifestyle',
    stock: 28,
  },
  {
    name: 'Extended Anti-Slip Desk Pad / Mouse Mat',
    description: 'Extra-large 900x400mm desk mat with smooth micro-woven cloth surface and stitched anti-fray edges for a clean desk setup.',
    price: 14.50,
    image: 'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?auto=format&fit=crop&w=600&q=80',
    category: 'accessories',
    stock: 35,
  },
  {
    name: '1080p Full HD Pro Streaming Webcam',
    description: 'Crystal-clear 1080p 30fps webcam with built-in dual noise-reducing stereo microphones and physical privacy shutter for online classes and presentations.',
    price: 32.99,
    image: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=600&q=80',
    category: 'electronics',
    stock: 20,
  },
  {
    name: 'Portable Waterproof Bluetooth 5.3 Speaker',
    description: 'Deep 360-degree punchy bass with IPX7 waterproof rating and 14-hour playtime. Built-in lanyard clip for travel and campus events.',
    price: 27.99,
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80',
    category: 'audio',
    stock: 22,
  },
  {
    name: 'Clean Code: A Handbook of Agile Craftsmanship',
    description: 'The legendary software engineering guide by Robert C. Martin on writing clean, readable, testable, and maintainable software.',
    price: 31.50,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    category: 'books',
    stock: 18,
  },
  {
    name: '7-in-1 Aluminium USB-C Multiport Hub',
    description: 'Expand your laptop with 4K HDMI, 100W USB-C Power Delivery charging, 3x USB 3.0 ports, and high-speed SD/TF card reader slots.',
    price: 26.50,
    image: 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?auto=format&fit=crop&w=600&q=80',
    category: 'electronics',
    stock: 30,
  },
  {
    name: 'Adjustable Eye-Care LED Desk Lamp',
    description: 'Flicker-free reading lamp with 5 color temperatures, 10 brightness levels, touch sensor controls, and USB charging output.',
    price: 21.99,
    image: 'https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&w=600&q=80',
    category: 'lifestyle',
    stock: 19,
  },
  {
    name: 'Protective Wool Felt Laptop Sleeve (13-15 Inch)',
    description: 'Minimalist shock-absorbent wool felt sleeve with soft suede interior lining and extra accessory pouch for charger and mouse.',
    price: 16.99,
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80',
    category: 'accessories',
    stock: 26,
  },
  {
    name: 'Cracking the Coding Interview (6th Edition)',
    description: '189 programming interview questions and solutions covering algorithms, system design, Big-O analysis, and behavioral tips for placements.',
    price: 28.99,
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    category: 'books',
    stock: 50,
  },
];

async function seedProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully.');

    console.log('🗑️  Clearing existing products...');
    const deleteResult = await Product.deleteMany({});
    console.log(`🧹 Removed ${deleteResult.deletedCount} existing products.`);

    console.log(`🌱 Inserting ${sampleProducts.length} realistic sample products...`);
    const created = await Product.insertMany(sampleProducts);
    console.log(`✅ Successfully seeded ${created.length} products!\n`);

    console.log('📋 Seeded Products Summary:');
    console.log('----------------------------------------------------------------------');
    created.forEach((p, idx) => {
      const num = String(idx + 1).padStart(2, ' ');
      const cat = p.category.toUpperCase().padEnd(11, ' ');
      const price = `$${p.price.toFixed(2)}`.padStart(7, ' ');
      const stock = `Stock: ${p.stock}`.padStart(10, ' ');
      console.log(` ${num}. [${cat}] ${p.name.padEnd(46, ' ')} | ${price} | ${stock}`);
    });
    console.log('----------------------------------------------------------------------');

    console.log('\n✨ Database seeding completed successfully!\n');
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seedProducts();
