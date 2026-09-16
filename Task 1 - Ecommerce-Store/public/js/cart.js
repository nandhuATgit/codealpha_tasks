/**
 * Shopping Cart Module (Vanilla JavaScript + localStorage)
 * Handles cart state, operations, calculations, and UI updates across all pages.
 */

const CART_STORAGE_KEY = 'college_store_cart';

const Cart = {
  /**
   * Retrieves cart array from localStorage
   * @returns {Array} Array of cart items
   */
  getItems() {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to parse cart from localStorage:', err);
      return [];
    }
  },

  /**
   * Saves cart array to localStorage, updates badges, and dispatches change event
   * @param {Array} items
   */
  save(items) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      this.updateNavbarBadge();
      window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
    } catch (err) {
      console.error('Failed to save cart to localStorage:', err);
    }
  },

  /**
   * Adds a product to the cart or increments quantity if duplicate exists
   * @param {Object} product - Product details { _id, name, price, image, category, stock }
   * @param {number} quantity - Number of units to add (default: 1)
   * @returns {Object} { success: boolean, message: string }
   */
  addItem(product, quantity = 1) {
    if (!product || (!product._id && !product.id)) {
      console.error('Invalid product passed to Cart.addItem:', product);
      return { success: false, message: 'Invalid product details.' };
    }

    const productId = product._id || product.id;
    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
    const cart = this.getItems();
    const existingIndex = cart.findIndex((item) => item.id === productId);

    const availableStock = typeof product.stock === 'number' ? product.stock : 999;

    if (existingIndex > -1) {
      // Duplicate product: increase quantity instead of creating duplicate entry
      const currentQty = cart[existingIndex].quantity;
      const newQty = currentQty + qtyToAdd;

      if (newQty > availableStock) {
        cart[existingIndex].quantity = availableStock;
        this.save(cart);
        this.showToast(`⚠️ Max stock reached for "${product.name}" (${availableStock} in cart)`);
        return { success: false, message: 'Max stock reached' };
      }

      cart[existingIndex].quantity = newQty;
      this.save(cart);
      this.showToast(`🛒 Updated "${product.name}" quantity (${newQty})`);
      return { success: true, message: 'Quantity updated' };
    } else {
      // New item to cart
      if (qtyToAdd > availableStock) {
        this.showToast(`⚠️ Only ${availableStock} units available for "${product.name}"`);
        return { success: false, message: 'Stock exceeded' };
      }

      const newItem = {
        id: productId,
        name: product.name,
        price: parseFloat(product.price) || 0,
        image: product.image || 'https://placehold.co/400x300?text=Product',
        category: product.category || 'General',
        stock: availableStock,
        quantity: qtyToAdd,
      };

      cart.push(newItem);
      this.save(cart);
      this.showToast(`🛒 Added "${product.name}" to cart!`);
      return { success: true, message: 'Item added' };
    }
  },

  /**
   * Increases item quantity by 1 (or delta)
   * @param {string} productId
   * @param {number} delta (default: +1)
   */
  increaseQuantity(productId, delta = 1) {
    const cart = this.getItems();
    const item = cart.find((i) => i.id === productId);
    if (!item) return;

    if (item.stock && item.quantity + delta > item.stock) {
      this.showToast(`⚠️ Cannot exceed available stock of ${item.stock}`);
      return;
    }

    item.quantity += delta;
    this.save(cart);
  },

  /**
   * Decreases item quantity by 1 (or delta). Removes item if quantity reaches 0.
   * @param {string} productId
   * @param {number} delta (default: 1)
   */
  decreaseQuantity(productId, delta = 1) {
    const cart = this.getItems();
    const index = cart.findIndex((i) => i.id === productId);
    if (index === -1) return;

    const newQty = cart[index].quantity - delta;
    if (newQty <= 0) {
      const removedName = cart[index].name;
      cart.splice(index, 1);
      this.save(cart);
      this.showToast(`🗑️ Removed "${removedName}" from cart`);
    } else {
      cart[index].quantity = newQty;
      this.save(cart);
    }
  },

  /**
   * Sets exact quantity for an item
   * @param {string} productId
   * @param {number} newQty
   */
  setQuantity(productId, newQty) {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      this.removeItem(productId);
      return;
    }

    const cart = this.getItems();
    const item = cart.find((i) => i.id === productId);
    if (!item) return;

    if (item.stock && qty > item.stock) {
      item.quantity = item.stock;
      this.showToast(`⚠️ Adjusted to maximum available stock (${item.stock})`);
    } else {
      item.quantity = qty;
    }

    this.save(cart);
  },

  /**
   * Removes a product entirely from the cart
   * @param {string} productId
   */
  removeItem(productId) {
    const cart = this.getItems();
    const index = cart.findIndex((i) => i.id === productId);
    if (index === -1) return;

    const removedName = cart[index].name;
    cart.splice(index, 1);
    this.save(cart);
    this.showToast(`🗑️ Removed "${removedName}" from cart`);
  },

  /**
   * Clears all items from the cart
   */
  clear() {
    this.save([]);
    this.showToast('🧹 Cart cleared');
  },

  /**
   * Total count of individual units in cart
   * @returns {number}
   */
  getItemCount() {
    const items = this.getItems();
    return items.reduce((total, item) => total + (parseInt(item.quantity, 10) || 0), 0);
  },

  /**
   * Calculates subtotal of all items
   * @returns {number}
   */
  getSubtotal() {
    const items = this.getItems();
    const subtotal = items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity, 10) || 0;
      return sum + price * qty;
    }, 0);
    return Math.round(subtotal * 100) / 100;
  },

  /**
   * Calculates final total (Subtotal + Shipping)
   * Free shipping for student orders!
   * @returns {number}
   */
  getTotal() {
    return this.getSubtotal();
  },

  /**
   * Updates cart item count badges in the navigation bar
   */
  updateNavbarBadge() {
    const count = this.getItemCount();
    const badgeEls = document.querySelectorAll('.cart-badge');

    badgeEls.forEach((el) => {
      el.textContent = count;
      if (count > 0) {
        el.style.display = 'inline-block';
        el.classList.add('badge-pulse');
        setTimeout(() => el.classList.remove('badge-pulse'), 300);
      } else {
        el.style.display = 'inline-block'; // Show 0 clearly
      }
    });
  },

  /**
   * Shows a modern floating toast notification
   * @param {string} message
   */
  showToast(message) {
    let container = document.getElementById('cart-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cart-toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.innerHTML = `
      <span>${message}</span>
      <a href="/cart.html" style="color: #ffffff; text-decoration: underline; margin-left: 0.75rem; font-weight: 600; font-size: 0.85rem;">View Cart</a>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  },
};

// Automatically update navbar badge when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateNavbarBadge();
});

// If running in Node.js environment (for unit testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cart;
}
