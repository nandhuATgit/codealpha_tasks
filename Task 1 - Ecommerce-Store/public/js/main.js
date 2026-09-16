/**
 * Main Client-Side JavaScript
 * Handles basic connectivity checks, authentication helpers, and UI interactions.
 */

// Base API URL
const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
  checkBackendStatus();
});

/**
 * Checks backend API and Database health status
 */
async function checkBackendStatus() {
  const statusBadge = document.getElementById('api-status-badge');
  const dbStatusEl = document.getElementById('db-status');
  const responseLogEl = document.getElementById('api-response-log');

  if (!statusBadge) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    statusBadge.textContent = 'Server Online';
    statusBadge.className = 'status-badge online';

    if (dbStatusEl) {
      dbStatusEl.textContent = `MongoDB: ${data.database}`;
    }

    if (responseLogEl) {
      responseLogEl.textContent = JSON.stringify(data, null, 2);
    }

    console.log('✅ Backend API Health Response:', data);
  } catch (error) {
    console.error('❌ Failed to connect to backend API:', error);
    statusBadge.textContent = 'Backend Offline';
    statusBadge.className = 'status-badge offline';

    if (dbStatusEl) {
      dbStatusEl.textContent = 'MongoDB: Disconnected';
    }

    if (responseLogEl) {
      responseLogEl.textContent = `Error connecting to backend: ${error.message}`;
    }
  }
}
