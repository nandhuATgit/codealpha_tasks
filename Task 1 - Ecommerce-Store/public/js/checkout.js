/**
 * Checkout Page Logic
 * Handles cart summary display, authentication checks, shipping validation,
 * order placement via POST /api/orders, and stock/cart clearing.
 */

document.addEventListener('DOMContentLoaded', () => {
  initCheckoutPage();
});

function initCheckoutPage() {
  const checkoutLayout = document.getElementById('checkout-layout');
  const emptyView = document.getElementById('checkout-empty-view');
  const authPrompt = document.getElementById('checkout-auth-prompt');
  const formCard = document.getElementById('checkout-form-card');
  const cartItems = Cart.getItems();

  // 1. Check if Cart is empty
  if (!cartItems || cartItems.length === 0) {
    if (checkoutLayout) checkoutLayout.style.display = 'none';
    if (emptyView) emptyView.style.display = 'block';
    return;
  }

  // 2. Check Authentication
  if (!Auth.isLoggedIn()) {
    if (authPrompt) authPrompt.style.display = 'block';
    if (formCard) formCard.style.display = 'none';
  } else {
    if (authPrompt) authPrompt.style.display = 'none';
    if (formCard) formCard.style.display = 'block';

    // Auto-fill recipient name if user is logged in
    const user = Auth.getUser();
    const nameInput = document.getElementById('fullName');
    if (nameInput && user && user.name) {
      nameInput.value = user.name;
    }
  }

  // 3. Render Cart Summary Sidebar
  renderCheckoutSummary(cartItems);

  // 4. Attach Form Submit Event
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handlePlaceOrder);
  }
}

/**
 * Renders the order summary in checkout sidebar
 */
function renderCheckoutSummary(items) {
  const summaryItemsList = document.getElementById('summary-items-list');
  const summarySubtotal = document.getElementById('summary-subtotal');
  const summaryTotal = document.getElementById('summary-total');
  const submitBtn = document.getElementById('btn-place-order');

  const subtotal = Cart.getSubtotal();
  const total = Cart.getTotal();

  if (summaryItemsList) {
    summaryItemsList.innerHTML = items
      .map(
        (item) => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; font-size: 0.9rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img 
            src="${escapeHTML(item.image)}" 
            alt="${escapeHTML(item.name)}" 
            style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border);"
            onerror="this.onerror=null; this.src='https://placehold.co/44x44?text=Item';"
          />
          <div>
            <div style="font-weight: 600; color: var(--dark); line-height: 1.3;">${escapeHTML(item.name)}</div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">Qty: ${item.quantity} × $${parseFloat(item.price).toFixed(2)}</div>
          </div>
        </div>
        <div style="font-weight: 600; color: var(--dark);">
          $${(parseFloat(item.price) * parseInt(item.quantity, 10)).toFixed(2)}
        </div>
      </div>
    `
      )
      .join('');
  }

  if (summarySubtotal) summarySubtotal.textContent = `$${subtotal.toFixed(2)}`;
  if (summaryTotal) summaryTotal.textContent = `$${total.toFixed(2)}`;
  if (submitBtn) submitBtn.textContent = `Place Order ($${total.toFixed(2)})`;
}

/**
 * Submits the order to backend API
 */
async function handlePlaceOrder(e) {
  e.preventDefault();

  const alertBox = document.getElementById('checkout-alert');
  const submitBtn = document.getElementById('btn-place-order');

  hideAlert(alertBox);

  // Check user authentication
  if (!Auth.isLoggedIn()) {
    showAlert(alertBox, 'Please log in to place your order.', 'error');
    return;
  }

  const fullName = document.getElementById('fullName')?.value.trim();
  const phone = document.getElementById('phone')?.value.trim();
  const address = document.getElementById('address')?.value.trim();
  const city = document.getElementById('city')?.value.trim();
  const postalCode = document.getElementById('postalCode')?.value.trim();
  const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodInput ? paymentMethodInput.value.toUpperCase() : 'COD';

  // Client Validation
  if (!fullName || !phone || !address || !city || !postalCode) {
    showAlert(alertBox, 'Please fill in all shipping fields.', 'error');
    return;
  }

  // Basic phone validation (at least 10 digits)
  const phoneClean = phone.replace(/[^0-9]/g, '');
  if (phoneClean.length < 10) {
    showAlert(alertBox, 'Please enter a valid 10-digit contact phone number.', 'error');
    return;
  }

  // Basic PIN code validation
  if (postalCode.length < 4) {
    showAlert(alertBox, 'Please enter a valid postal / PIN code.', 'error');
    return;
  }

  const cartItems = Cart.getItems();
  if (!cartItems || cartItems.length === 0) {
    showAlert(alertBox, 'Your cart is empty. Please add products first.', 'error');
    return;
  }

  // Format products payload for backend
  const productsPayload = cartItems.map((item) => ({
    product: item.id,
    quantity: item.quantity,
  }));

  const orderPayload = {
    products: productsPayload,
    shippingAddress: {
      fullName,
      phone,
      address,
      city,
      postalCode,
      country: 'India',
    },
    paymentMethod,
  };

  // Set loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Order...';
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
  }

  try {
    const response = await fetch(`${window.location.origin}/api/orders`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to place order.');
    }

    // 1. Clear frontend shopping cart
    Cart.clear();

    // 2. Render Order Success Screen
    renderOrderSuccess(data.order);
  } catch (error) {
    console.error('Order placement error:', error);
    showAlert(alertBox, error.message, 'error');

    if (submitBtn) {
      submitBtn.disabled = false;
      const total = Cart.getTotal();
      submitBtn.textContent = `Place Order ($${total.toFixed(2)})`;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }
}

/**
 * Renders order confirmation screen
 */
function renderOrderSuccess(order) {
  const container = document.querySelector('main.container');
  if (!container) return;

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  container.innerHTML = `
    <div style="max-width: 680px; margin: 2rem auto; background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; text-align: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
      <div style="width: 72px; height: 72px; background: #d1fae5; color: #059669; font-size: 2.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
        ✓
      </div>

      <h1 style="font-size: 1.85rem; color: var(--dark); margin-bottom: 0.5rem;">Thank You! Your Order is Confirmed</h1>
      <p style="color: var(--text-muted); font-size: 1rem; margin-bottom: 2rem;">
        We have received your order. Payment will be collected via <strong>Cash on Delivery (COD)</strong> upon campus handover.
      </p>

      <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; text-align: left; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem;">
          <span style="color: var(--text-muted);">Order ID:</span>
          <span style="font-weight: 700; color: var(--primary); font-family: monospace;">${order._id}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem;">
          <span style="color: var(--text-muted);">Order Date:</span>
          <span style="font-weight: 600;">${orderDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem;">
          <span style="color: var(--text-muted);">Payment Mode:</span>
          <span style="font-weight: 600; color: #166534; background: #dcfce7; padding: 0.15rem 0.5rem; border-radius: 4px;">
            ${order.paymentMethod} (Cash on Delivery)
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem;">
          <span style="color: var(--text-muted);">Deliver To:</span>
          <span style="font-weight: 600; text-align: right;">
            ${escapeHTML(order.shippingAddress.fullName)} (${escapeHTML(order.shippingAddress.phone)})<br>
            ${escapeHTML(order.shippingAddress.address)}, ${escapeHTML(order.shippingAddress.city)} - ${escapeHTML(order.shippingAddress.postalCode)}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 1rem; border-top: 2px dashed var(--border); font-size: 1.2rem; font-weight: 800;">
          <span>Total Amount Payable:</span>
          <span style="color: var(--primary);">$${Number(order.totalAmount).toFixed(2)}</span>
        </div>
      </div>

      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="/index.html" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
          Continue Shopping
        </a>
        <a href="/product.html" class="btn btn-secondary" style="padding: 0.75rem 1.5rem;">
          Browse Catalog
        </a>
      </div>
    </div>
  `;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.className = `alert-box alert-${type}`;
}

function hideAlert(el) {
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
