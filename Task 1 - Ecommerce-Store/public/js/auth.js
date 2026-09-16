/**
 * Authentication Module for College E-Commerce Store
 * Manages JWT tokens, localStorage session persistence, navbar state, and form submissions.
 */

const API_AUTH_URL = `${window.location.origin}/api/auth`;

const Auth = {
  /**
   * Get stored JWT token
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem('token');
  },

  /**
   * Get stored user object
   * @returns {Object|null}
   */
  getUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (err) {
      console.error('Failed to parse user from localStorage:', err);
      return null;
    }
  },

  /**
   * Check if user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Save session token and user profile
   * @param {string} token
   * @param {Object} user
   */
  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.updateNavbar();
  },

  /**
   * Clear session token and user data
   */
  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.updateNavbar();
  },

  /**
   * Log out user, notify, and redirect
   */
  logout() {
    this.clearSession();
    if (typeof Cart !== 'undefined' && Cart.showToast) {
      Cart.showToast('👋 You have been logged out.');
    }
    // Redirect to login page after a brief delay
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 400);
  },

  /**
   * Returns authorization headers for protected API requests
   * @returns {Object}
   */
  getAuthHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  /**
   * Updates the navbar links depending on login status
   */
  updateNavbar() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Look for existing auth container in navLinks
    let authNavItems = document.getElementById('nav-auth-section');

    const user = this.getUser();
    const loggedIn = this.isLoggedIn() && user;

    // If there is an existing static login & register link, remove them or wrap them
    const staticLogin = navLinks.querySelector('a[href="/login.html"]')?.parentElement;
    const staticRegister = navLinks.querySelector('a[href="/register.html"]')?.parentElement;

    if (loggedIn) {
      // Hide static login & register
      if (staticLogin) staticLogin.style.display = 'none';
      if (staticRegister) staticRegister.style.display = 'none';

      // Create or update dynamic auth section
      if (!authNavItems) {
        authNavItems = document.createElement('li');
        authNavItems.id = 'nav-auth-section';
        authNavItems.style.display = 'flex';
        authNavItems.style.alignItems = 'center';
        authNavItems.style.gap = '0.75rem';
        navLinks.appendChild(authNavItems);
      }

      authNavItems.innerHTML = `
        <span style="font-size: 0.9rem; font-weight: 600; color: var(--dark); background: #e2e8f0; padding: 0.35rem 0.75rem; border-radius: 9999px;">
          👤 ${escapeHTML(user.name)}
        </span>
        <button 
          type="button" 
          onclick="Auth.logout()" 
          class="btn btn-secondary" 
          style="padding: 0.35rem 0.8rem; font-size: 0.85rem;"
          title="Sign out of your account"
        >
          Logout
        </button>
      `;
    } else {
      // Show static login & register
      if (staticLogin) staticLogin.style.display = '';
      if (staticRegister) staticRegister.style.display = '';

      // Remove dynamic section if exists
      if (authNavItems) {
        authNavItems.remove();
      }
    }
  },
};

// Explicitly attach to window for global access
window.Auth = Auth;

/**
 * Initializes Registration Form logic
 */
function initRegisterForm() {
  const form = document.getElementById('register-form');
  const alertBox = document.getElementById('auth-alert');
  if (!form) return;

  // Inform user if already logged in, but keep form available for testing
  if (Auth.isLoggedIn()) {
    const currentUser = Auth.getUser();
    if (currentUser && alertBox) {
      showAlert(
        alertBox,
        `ℹ️ You are currently signed in as "${escapeHTML(currentUser.name)}". You can register a new account below or return to the store.`,
        'success'
      );
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Reset alert
    hideAlert(alertBox);

    // Client-side validations
    if (!name || !email || !password || !confirmPassword) {
      showAlert(alertBox, 'Please fill in all fields.', 'error');
      return;
    }

    if (name.length < 2) {
      showAlert(alertBox, 'Name must be at least 2 characters long.', 'error');
      return;
    }

    if (password.length < 6) {
      showAlert(alertBox, 'Password must be at least 6 characters long.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertBox, 'Passwords do not match. Please re-enter.', 'error');
      return;
    }

    // Set loading state
    setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      console.log('Sending registration request for:', email);
      const response = await fetch(`${API_AUTH_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      // Save token and user in localStorage
      Auth.setSession(data.token, data.user);
      console.log('Registration successful, token saved in localStorage:', data.token);

      showAlert(alertBox, '🎉 Account registered successfully! Redirecting to store...', 'success');

      // Redirect to index.html after 1 second
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    } catch (error) {
      console.error('Registration error:', error);
      showAlert(alertBox, error.message, 'error');
      setButtonLoading(submitBtn, false, 'Create Account');
    }
  });
}

/**
 * Initializes Login Form logic
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('auth-alert');
  if (!form) return;

  // Inform user if already logged in, but keep form available for testing
  if (Auth.isLoggedIn()) {
    const currentUser = Auth.getUser();
    if (currentUser && alertBox) {
      showAlert(
        alertBox,
        `ℹ️ You are currently signed in as "${escapeHTML(currentUser.name)}". You can sign in with another account below or return to the store.`,
        'success'
      );
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    // Reset alert
    hideAlert(alertBox);

    // Client-side validation
    if (!email || !password) {
      showAlert(alertBox, 'Please enter both your email and password.', 'error');
      return;
    }

    // Set loading state
    setButtonLoading(submitBtn, true, 'Signing In...');

    try {
      console.log('Sending login request for:', email);
      const response = await fetch(`${API_AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid credentials.');
      }

      // Save token and user in localStorage
      Auth.setSession(data.token, data.user);
      console.log('Login successful, token saved in localStorage:', data.token);

      showAlert(alertBox, '✅ Login successful! Redirecting to store...', 'success');

      // Redirect to index.html after 1 second
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      showAlert(alertBox, error.message, 'error');
      setButtonLoading(submitBtn, false, 'Sign In');
    }
  });
}

/**
 * UI Helpers for alert messages
 */
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

function setButtonLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = text;
  btn.style.opacity = isLoading ? '0.7' : '1';
  btn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
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

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Auth.updateNavbar();
  initRegisterForm();
  initLoginForm();
});
