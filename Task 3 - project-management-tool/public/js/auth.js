/**
 * Authentication utilities & Form Handlers
 * Task 3 - Project Management Tool
 */

const AUTH_KEYS = {
  TOKEN: 'pm_auth_token',
  USER: 'pm_auth_user'
};

// Storage Utilities
function getToken() {
  return localStorage.getItem(AUTH_KEYS.TOKEN);
}

function setToken(token) {
  localStorage.setItem(AUTH_KEYS.TOKEN, token);
}

function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEYS.TOKEN);
  localStorage.removeItem(AUTH_KEYS.USER);
}

function isAuthenticated() {
  return Boolean(getToken());
}

// Redirect already logged-in users away from login/register pages
function redirectIfLoggedIn() {
  if (isAuthenticated()) {
    window.location.href = 'dashboard.html';
  }
}

// Alert helper
function showAlert(elementId, message, type = 'error') {
  const alertEl = document.getElementById(elementId);
  if (!alertEl) return;

  alertEl.textContent = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.style.display = 'flex';
}

function hideAlert(elementId) {
  const alertEl = document.getElementById(elementId);
  if (alertEl) {
    alertEl.style.display = 'none';
  }
}

// Attach Form Event Listeners once DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // 1. Login Form Handling
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    redirectIfLoggedIn();

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('loginAlert');

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const credential = document.getElementById('credential').value.trim();
      const password = document.getElementById('password').value;

      if (!credential || !password) {
        showAlert('loginAlert', 'Please enter your username/email and password.');
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Signing in...';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          showAlert('loginAlert', data.error || 'Failed to sign in. Please try again.');
          return;
        }

        // Store credentials
        setToken(data.token);
        setUser(data.user);

        showAlert('loginAlert', 'Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      } catch (err) {
        console.error('Login error:', err);
        showAlert('loginAlert', 'Network or server error. Please ensure the server is running.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 2. Registration Form Handling
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    redirectIfLoggedIn();

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('registerAlert');

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const name = document.getElementById('name').value.trim();
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      // Client-side validations
      if (!name || !username || !email || !password || !confirmPassword) {
        showAlert('registerAlert', 'Please fill in all required fields.');
        return;
      }

      if (username.length < 3) {
        showAlert('registerAlert', 'Username must be at least 3 characters long.');
        return;
      }

      if (password.length < 6) {
        showAlert('registerAlert', 'Password must be at least 6 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        showAlert('registerAlert', 'Passwords do not match. Please re-check.');
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Creating account...';

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          showAlert('registerAlert', data.error || 'Registration failed. Please try again.');
          return;
        }

        // Store token & user upon auto-login
        setToken(data.token);
        setUser(data.user);

        showAlert('registerAlert', 'Registration successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 700);
      } catch (err) {
        console.error('Registration error:', err);
        showAlert('registerAlert', 'Network or server error. Please ensure the server is running.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});
