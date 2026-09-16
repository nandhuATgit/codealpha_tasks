/**
 * Cart Page Logic & Rendering
 * Powers the interactive cart view on public/cart.html
 */

document.addEventListener('DOMContentLoaded', () => {
  renderCartPage();

  // Re-render whenever cart state changes
  window.addEventListener('cart:updated', () => {
    renderCartPage();
  });
});

/**
 * Main render function for cart.html
 */
function renderCartPage() {
  const container = document.getElementById('cart-view-container');
  if (!container) return;

  const items = Cart.getItems();

  // 1. Show Empty Cart State
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <h3>Your Cart is Currently Empty</h3>
        <p>Explore our college tech and essentials catalog to find what you need for this semester!</p>
        <a href="/product.html" class="btn btn-primary" style="padding: 0.75rem 1.75rem; font-size: 1rem;">
          Browse Products
        </a>
      </div>
    `;
    return;
  }

  // 2. Calculate values
  const subtotal = Cart.getSubtotal();
  const total = Cart.getTotal();
  const totalCount = Cart.getItemCount();

  // 3. Render Cart Grid
  container.innerHTML = `
    <div class="cart-container-grid">
      <!-- Left Column: Items List -->
      <div class="cart-table-card">
        <div class="cart-card-header">
          <h2 style="font-size: 1.2rem; color: var(--dark);">
            Cart Items (${totalCount} ${totalCount === 1 ? 'unit' : 'units'})
          </h2>
          <button 
            type="button" 
            onclick="handleClearCart()" 
            class="btn btn-secondary" 
            style="padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--error); border-color: #fca5a5;"
          >
            Clear All
          </button>
        </div>

        <div class="cart-items-list">
          ${items.map(renderCartItemRow).join('')}
        </div>

        <div style="padding: 1.25rem 1.5rem; background: #fafafa; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <a href="/product.html" style="color: var(--primary); text-decoration: none; font-weight: 600; font-size: 0.9rem;">
            &larr; Continue Shopping
          </a>
          <span style="font-size: 0.85rem; color: var(--text-muted);">
            Items saved in your browser
          </span>
        </div>
      </div>

      <!-- Right Column: Order Summary Card -->
      <div class="cart-summary-card">
        <h3 class="cart-summary-title">Order Summary</h3>
        
        <div class="cart-summary-line">
          <span>Subtotal (${totalCount} items):</span>
          <span style="font-weight: 600;">$${subtotal.toFixed(2)}</span>
        </div>

        <div class="cart-summary-line">
          <span>Campus Shipping:</span>
          <span style="color: var(--success); font-weight: 600;">FREE</span>
        </div>

        <div class="cart-summary-line">
          <span>Student Discount:</span>
          <span style="color: var(--text-muted);">$0.00</span>
        </div>

        <div class="cart-summary-total-line">
          <span>Estimated Total:</span>
          <span class="total-val">$${total.toFixed(2)}</span>
        </div>

        <a 
          href="/checkout.html" 
          class="btn btn-primary" 
          style="display: block; text-align: center; width: 100%; margin-top: 1.5rem; padding: 0.85rem; font-size: 1.05rem;"
        >
          Proceed to Checkout &rarr;
        </a>

        <div style="margin-top: 1.25rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">
          🔒 Secure local checkout ready
        </div>
      </div>
    </div>
  `;
}

/**
 * Creates HTML for a single cart row
 */
function renderCartItemRow(item) {
  const itemTotal = (parseFloat(item.price) * parseInt(item.quantity, 10)).toFixed(2);
  const fallbackImage = 'https://placehold.co/100x100?text=Item';

  return `
    <div class="cart-item-row" data-id="${item.id}">
      <img 
        src="${escapeHTML(item.image)}" 
        alt="${escapeHTML(item.name)}" 
        class="cart-item-thumb"
        onerror="this.onerror=null; this.src='${fallbackImage}';"
      />

      <div class="cart-item-details">
        <span class="cart-item-cat">${escapeHTML(item.category)}</span>
        <a href="/product.html?id=${item.id}" class="cart-item-name">
          ${escapeHTML(item.name)}
        </a>
        <span class="cart-item-unit-price">$${parseFloat(item.price).toFixed(2)} each</span>
      </div>

      <!-- Quantity Controls -->
      <div class="cart-qty-control">
        <button 
          type="button" 
          class="cart-qty-btn" 
          onclick="Cart.decreaseQuantity('${item.id}', 1)"
          title="Decrease quantity"
        >
          -
        </button>
        <span class="cart-qty-val">${item.quantity}</span>
        <button 
          type="button" 
          class="cart-qty-btn" 
          onclick="Cart.increaseQuantity('${item.id}', 1)"
          title="Increase quantity"
        >
          +
        </button>
      </div>

      <!-- Item Total -->
      <div class="cart-item-total">
        $${itemTotal}
      </div>

      <!-- Remove Button -->
      <button 
        type="button" 
        class="cart-item-remove-btn" 
        onclick="Cart.removeItem('${item.id}')"
        title="Remove item"
      >
        🗑️
      </button>
    </div>
  `;
}

/**
 * Handler for Clear Cart button
 */
function handleClearCart() {
  if (confirm('Are you sure you want to remove all items from your cart?')) {
    Cart.clear();
  }
}

/**
 * Safe HTML escaping
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
