/**
 * Product Management & UI Rendering (Vanilla JS fetch)
 */

const API_PRODUCTS_URL = `${window.location.origin}/api/products`;

/**
 * Creates HTML string for an individual product card
 */
function createProductCardHTML(product) {
  const isOutOfStock = product.stock <= 0;
  const stockBadge = isOutOfStock
    ? '<span class="stock-status stock-out">Out of Stock</span>'
    : `<span class="stock-status stock-in">In Stock (${product.stock})</span>`;

  // Fallback placeholder image if image fails to load
  const fallbackImage = 'https://placehold.co/400x300?text=Product';

  return `
    <article class="product-card">
      <div class="product-image-container">
        <span class="product-category-tag">${escapeHTML(product.category)}</span>
        <img 
          src="${escapeHTML(product.image)}" 
          alt="${escapeHTML(product.name)}" 
          class="product-image"
          loading="lazy"
          onerror="this.onerror=null; this.src='${fallbackImage}';"
        />
      </div>
      <div class="product-info">
        <h3 class="product-title">${escapeHTML(product.name)}</h3>
        <p class="product-desc">${escapeHTML(product.description)}</p>
        <div class="product-meta">
          <div>
            <div class="product-price">$${Number(product.price).toFixed(2)}</div>
            ${stockBadge}
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <a href="/product.html?id=${product._id}" class="btn btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.85rem;">
              View Details
            </a>
            <button 
              type="button" 
              class="btn btn-primary" 
              style="padding: 0.45rem 0.85rem; font-size: 0.85rem;" 
              onclick="handleQuickAddToCart('${product._id}')"
              ${isOutOfStock ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}
              title="${isOutOfStock ? 'Out of Stock' : 'Add 1 to Cart'}"
            >
              ${isOutOfStock ? 'Out' : '🛒 Add'}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Loads and renders products into a container element
 */
async function loadProducts(containerId, { category = '', search = '' } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted);">
      <p style="font-size: 1.1rem;">⏳ Loading products...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const url = `${API_PRODUCTS_URL}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch products');
    }

    if (!data.products || data.products.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">📦</div>
          <h3 style="margin-bottom: 0.5rem; color: var(--dark);">No Products Found</h3>
          <p style="color: var(--text-muted); margin-bottom: 1.25rem;">
            ${category || search ? 'Try clearing your search or filter.' : 'The store catalog is currently empty. Run <code>npm run seed</code> to populate sample items!'}
          </p>
          ${category || search ? '<button class="btn btn-secondary" onclick="resetFilters()">Clear Filters</button>' : ''}
        </div>
      `;
      return;
    }

    // Cache products for fast synchronous Cart additions
    window._productsCache = window._productsCache || {};
    data.products.forEach((p) => {
      window._productsCache[p._id] = p;
    });

    container.innerHTML = data.products.map(createProductCardHTML).join('');
  } catch (error) {
    console.error('Failed to load products:', error);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #fee2e2; border-radius: 12px; color: #991b1b;">
        <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">⚠️ Unable to load products</h4>
        <p style="font-size: 0.9rem; margin-bottom: 1rem;">${escapeHTML(error.message)}</p>
        <button class="btn btn-secondary" onclick="loadProducts('${containerId}')">Retry</button>
      </div>
    `;
  }
}

/**
 * Loads and displays an individual product's detail page
 */
async function loadProductDetail(containerId, productId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!productId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: #ffffff; border-radius: 12px;">
        <h3>No Product Selected</h3>
        <p style="color: var(--text-muted); margin: 0.5rem 0 1.5rem 0;">Please select a product from our catalog.</p>
        <a href="/index.html" class="btn btn-primary">&larr; Back to Products</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p style="font-size: 1.1rem;">⏳ Loading product details...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_PRODUCTS_URL}/${productId}`);
    const data = await response.json();

    if (!response.ok || !data.success || !data.product) {
      throw new Error(data.message || 'Product not found');
    }

    const p = data.product;
    window._currentProduct = p; // Store for detail cart addition
    const isOutOfStock = p.stock <= 0;
    const fallbackImage = 'https://placehold.co/600x600?text=Product';

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <a href="/product.html" class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;">
          &larr; Back to Catalog
        </a>
      </div>

      <div class="product-detail-layout">
        <div class="product-detail-image-box">
          <img 
            src="${escapeHTML(p.image)}" 
            alt="${escapeHTML(p.name)}" 
            onerror="this.onerror=null; this.src='${fallbackImage}';"
          />
        </div>

        <div class="product-detail-info">
          <span class="product-detail-badge">${escapeHTML(p.category)}</span>
          <h1 class="product-detail-title">${escapeHTML(p.name)}</h1>
          
          <div class="product-detail-price">$${Number(p.price).toFixed(2)}</div>
          
          <div style="margin-bottom: 1rem;">
            ${
              isOutOfStock
                ? '<span class="stock-status stock-out" style="font-size: 0.9rem; padding: 0.3rem 0.7rem;">Out of Stock</span>'
                : `<span class="stock-status stock-in" style="font-size: 0.9rem; padding: 0.3rem 0.7rem;">In Stock (${p.stock} units available)</span>`
            }
          </div>

          <div class="product-detail-desc">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Product Overview</h4>
            <p>${escapeHTML(p.description)}</p>
          </div>

          <div class="product-detail-actions">
            <div class="quantity-picker">
              <button type="button" onclick="adjustQty(-1)" ${isOutOfStock ? 'disabled' : ''}>-</button>
              <input type="text" id="detail-qty" value="1" readonly>
              <button type="button" onclick="adjustQty(1, ${p.stock})" ${isOutOfStock ? 'disabled' : ''}>+</button>
            </div>
            <button 
              type="button"
              class="btn btn-primary" 
              style="flex: 1; padding: 0.75rem 1.5rem;"
              ${isOutOfStock ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}
              onclick="handleDetailAddToCart()"
            >
              ${isOutOfStock ? 'Currently Unavailable' : '🛒 Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.title = `${p.name} | CollegeStore`;
  } catch (error) {
    console.error('Error loading product details:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: #ffffff; border-radius: 12px; border: 1px solid var(--border);">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;">🔍</div>
        <h2 style="color: var(--dark); margin-bottom: 0.5rem;">Product Not Found</h2>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${escapeHTML(error.message)}</p>
        <a href="/product.html" class="btn btn-primary">&larr; Browse All Products</a>
      </div>
    `;
  }
}

/**
 * Adjust quantity on detail view
 */
function adjustQty(change, maxStock = 99) {
  const qtyInput = document.getElementById('detail-qty');
  if (!qtyInput) return;
  let val = parseInt(qtyInput.value, 10) || 1;
  val += change;
  if (val < 1) val = 1;
  if (val > maxStock) val = maxStock;
  qtyInput.value = val;
}

/**
 * Quick Add to Cart handler from product card (+ button)
 */
async function handleQuickAddToCart(productId) {
  if (typeof Cart === 'undefined') {
    console.error('Cart module not loaded');
    return;
  }

  // Use cached product if present
  let product = window._productsCache ? window._productsCache[productId] : null;

  if (!product) {
    try {
      const res = await fetch(`${API_PRODUCTS_URL}/${productId}`);
      const data = await res.json();
      if (data.success && data.product) {
        product = data.product;
      }
    } catch (err) {
      console.error('Failed to fetch product for cart:', err);
    }
  }

  if (product) {
    Cart.addItem(product, 1);
  }
}

/**
 * Add to Cart handler for detail page
 */
function handleDetailAddToCart() {
  if (typeof Cart === 'undefined') {
    console.error('Cart module not loaded');
    return;
  }

  if (!window._currentProduct) {
    console.error('No current product found');
    return;
  }

  const qtyInput = document.getElementById('detail-qty');
  const qty = parseInt(qtyInput?.value || '1', 10);
  Cart.addItem(window._currentProduct, qty);
}

/**
 * Helper to prevent XSS injection in dynamic text
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
