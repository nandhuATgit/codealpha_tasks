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
      // strip query string from href for comparison
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
        <a href="/index.html" class="${activeClass("/index.html")}"><span>🏠</span> Home</a>
        <a href="/create-post.html" class="${activeClass("/create-post.html")}"><span>✍️</span> Create Post</a>
        <a href="${profileHref}" class="${isProfileActive}"><span>👤</span> Profile</a>
        <a href="#" id="navLogoutBtn" class="nav-logout"><span>🚪</span> Logout</a>
      `;

      document.getElementById("navLogoutBtn").addEventListener("click", (e) => {
        e.preventDefault();
        window.logout();
      });
    } else {
      navbar.innerHTML = `
        <a href="/index.html" class="${activeClass("/index.html")}"><span>🏠</span> Home</a>
        <a href="/login.html" class="${activeClass("/login.html")}"><span>🔐</span> Login</a>
        <a href="/register.html" class="${activeClass("/register.html")}"><span>🚀</span> Register</a>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderNavbar);
  } else {
    renderNavbar();
  }
})();
