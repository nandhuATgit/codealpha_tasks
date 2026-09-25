/**
 * Real-Time Notifications Component
 * Full-Stack Project Management Tool - Task 3
 */

let notificationsList = [];
let unreadCount = 0;
let globalSocket = null;

// Helper: relative time formatter
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Helper: get icon and badge class by notification type
function getNotificationVisuals(type) {
  switch (type) {
    case 'task_assigned':
      return { icon: '📋', cls: 'notification-icon-task' };
    case 'task_status_changed':
      return { icon: '🔄', cls: 'notification-icon-status' };
    case 'comment_added':
      return { icon: '💬', cls: 'notification-icon-comment' };
    case 'project_added':
      return { icon: '🚀', cls: 'notification-icon-project' };
    default:
      return { icon: '🔔', cls: 'notification-icon-task' };
  }
}

// Escape HTML
function escapeNotificationText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Show Floating Toast Alert
function showToast(message, type = 'info', icon = '🔔') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">${escapeNotificationText(message)}</div>
    <button class="toast-close" title="Close">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// Update Badge in Navbar
function updateNotificationBadge(count) {
  unreadCount = Math.max(0, count);
  const badge = document.getElementById('navNotificationBadge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '0';
    badge.classList.add('hidden');
  }
}

// Render Notifications in Dropdown
function renderNotifications(notifications) {
  notificationsList = notifications || [];
  const listEl = document.getElementById('navNotificationList');
  if (!listEl) return;

  if (notificationsList.length === 0) {
    listEl.innerHTML = '<div class="notification-empty">No notifications yet. You\'re all caught up! ✨</div>';
    return;
  }

  listEl.innerHTML = '';
  notificationsList.forEach((notif) => {
    const item = document.createElement('div');
    item.className = `notification-item ${notif.read ? '' : 'unread'}`;
    item.dataset.id = notif._id;

    const visuals = getNotificationVisuals(notif.type);

    item.innerHTML = `
      <div class="notification-icon-box ${visuals.cls}">${visuals.icon}</div>
      <div class="notification-content">
        <div class="notification-msg">${escapeNotificationText(notif.message)}</div>
        <div class="notification-meta">
          <span>${formatTimeAgo(notif.createdAt)}</span>
          ${!notif.read ? '<span class="notification-unread-dot" title="Unread"></span>' : ''}
        </div>
      </div>
    `;

    item.addEventListener('click', async () => {
      await handleNotificationClick(notif);
    });

    listEl.appendChild(item);
  });
}

// Handle clicking a notification
async function handleNotificationClick(notif) {
  try {
    if (!notif.read) {
      const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
      await fetch(`/api/notifications/${notif._id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      notif.read = true;
      updateNotificationBadge(unreadCount - 1);

      const el = document.querySelector(`.notification-item[data-id="${notif._id}"]`);
      if (el) {
        el.classList.remove('unread');
        const dot = el.querySelector('.notification-unread-dot');
        if (dot) dot.remove();
      }
    }

    // Navigate to project if project is attached
    if (notif.project) {
      const projId = notif.project._id || notif.project;
      const currentUrl = window.location.pathname;
      const targetUrl = `project.html?id=${projId}`;

      if (currentUrl.includes('project.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('id') !== projId.toString()) {
          window.location.href = targetUrl;
        }
      } else {
        window.location.href = targetUrl;
      }
    }
  } catch (err) {
    console.error('Error handling notification click:', err);
  }
}

// Mark All As Read
async function markAllNotificationsRead() {
  try {
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
    const res = await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      notificationsList.forEach((n) => (n.read = true));
      renderNotifications(notificationsList);
      updateNotificationBadge(0);
    }
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
}

// Handle Incoming Real-Time Notification
function handleIncomingNotification(notification) {
  // Prepend to current list
  notificationsList.unshift(notification);
  renderNotifications(notificationsList);
  updateNotificationBadge(unreadCount + 1);

  // Show Toast
  const visuals = getNotificationVisuals(notification.type);
  showToast(notification.message, 'info', visuals.icon);
}

// Fetch Initial Notifications
async function fetchInitialNotifications() {
  try {
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
    if (!token) return;

    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;
    const data = await res.json();

    if (data.success) {
      updateNotificationBadge(data.unreadCount);
      renderNotifications(data.notifications);
    }
  } catch (err) {
    console.error('Failed to fetch initial notifications:', err);
  }
}

// Initialize Socket.IO connection
function initNotificationsSocket() {
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
  if (!token) return null;

  if (typeof io !== 'undefined') {
    globalSocket = io({
      auth: { token }
    });

    window.sharedAppSocket = globalSocket;

    globalSocket.on('connect', () => {
      // Socket connected
    });

    globalSocket.on('notification:new', (notification) => {
      handleIncomingNotification(notification);
    });

    globalSocket.on('notification:count', ({ unreadCount: count }) => {
      updateNotificationBadge(count);
    });

    globalSocket.on('connect_error', (err) => {
      console.warn('Real-time socket warning:', err.message);
    });
  }

  return globalSocket;
}

// Initialize UI events & setup
document.addEventListener('DOMContentLoaded', () => {
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
  if (!token) return;

  const bellBtn = document.getElementById('notificationBellBtn');
  const dropdown = document.getElementById('navNotificationDropdown');
  const markAllBtn = document.getElementById('markAllReadBtn');

  if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      markAllNotificationsRead();
    });
  }

  // Initialize socket and fetch notifications
  initNotificationsSocket();
  fetchInitialNotifications();
});
