// ============================================================
// app.js — Shared Navigation & Route Protection
// Must be loaded FIRST on every page (before page-specific scripts).
// ============================================================

(function () {
  // ── Auth helpers ──────────────────────────────────────────
  window.getAuthToken = () => localStorage.getItem("token");
  window.getAuthUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      return null;
    }
  };

  window.logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  };

  // ── Route protection ──────────────────────────────────────
  const token = localStorage.getItem("token");
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    loggedInUser = null;
  }

  const path = window.location.pathname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const requestedUsername = urlParams.get("username");

  // Pages that always require login
  const protectedPaths = ["/create-post.html"];

  // /profile.html without a ?username= param is the "my profile" page — requires login
  const isProtected =
    protectedPaths.some((p) => path.endsWith(p)) ||
    (path.endsWith("/profile.html") && !requestedUsername);

  if (isProtected && (!token || !loggedInUser)) {
    window.location.replace("/login.html");
    return; // Stop executing — redirect is in progress
  }

  // If already logged in, redirect away from login/register pages
  const authOnlyPages = ["/login.html", "/register.html"];
  if (token && loggedInUser && authOnlyPages.some((p) => path.endsWith(p))) {
    window.location.replace("/index.html");
    return;
  }

  // ── Navbar rendering ──────────────────────────────────────
  function renderNavbar() {
    const navbar = document.getElementById("navbar");
    if (!navbar) return;

    const currentToken = localStorage.getItem("token");
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      currentUser = null;
    }

    const isLoggedIn = Boolean(currentToken && currentUser);

    // Helper: mark the link active if the path matches
    function activeClass(href) {
      const hrefPath = href.split("?")[0].toLowerCase();
      return path.endsWith(hrefPath) || (hrefPath.endsWith("/index.html") && (path === "/" || path.endsWith("/index.html")))
        ? "active"
        : "";
    }

    if (isLoggedIn) {
      const username = encodeURIComponent(currentUser.username || "");
      const profileHref = `/profile.html?username=${username}`;
      const isProfileActive =
        path.endsWith("/profile.html") && requestedUsername === currentUser.username
          ? "active"
          : "";

      navbar.innerHTML = `
        <a href="/index.html" class="${activeClass("/index.html")}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Home</span>
        </a>
        <a href="/create-post.html" class="${activeClass("/create-post.html")}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <span>Create Post</span>
        </a>
        <a href="${profileHref}" class="${isProfileActive}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
          <span>Profile</span>
        </a>
        <a href="#" id="navLogoutBtn" class="nav-logout">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span>Logout</span>
        </a>
      `;

      document.getElementById("navLogoutBtn").addEventListener("click", (e) => {
        e.preventDefault();
        window.logout();
      });
    } else {
      navbar.innerHTML = `
        <a href="/index.html" class="${activeClass("/index.html")}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Home</span>
        </a>
        <a href="/login.html" class="${activeClass("/login.html")}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
          <span>Login</span>
        </a>
        <a href="/register.html" class="${activeClass("/register.html")}">
          <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          <span>Register</span>
        </a>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderNavbar);
  } else {
    renderNavbar();
  }
})();
