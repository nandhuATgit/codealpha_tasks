// Authentication helper and form handlers

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const alertBox = document.getElementById("alertBox");

  function showAlert(message, type = "error") {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = "block";
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.textContent = "";
    alertBox.style.display = "none";
  }

  // Registration Handler
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const name = document.getElementById("name").value.trim();
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const submitBtn = document.getElementById("submitBtn");

      // Frontend validation
      if (!name || !username || !email || !password || !confirmPassword) {
        showAlert("All fields are required.");
        return;
      }

      if (name.length < 2 || name.length > 50) {
        showAlert("Name must be between 2 and 50 characters.");
        return;
      }

      if (username.length < 3 || username.length > 30) {
        showAlert("Username must be between 3 and 30 characters.");
        return;
      }

      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        showAlert("Username can only contain letters, numbers, and underscores.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showAlert("Please enter a valid email address.");
        return;
      }

      if (password.length < 6) {
        showAlert("Password must be at least 6 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        showAlert("Passwords do not match.");
        return;
      }

      try {
        if (submitBtn) submitBtn.disabled = true;
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, username, email, password }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          showAlert(data.message || "Registration failed. Please try again.");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        showAlert("Registration successful! Redirecting to login...", "success");
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 1200);
      } catch (err) {
        showAlert("Network error or server unreachable. Please try again.");
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Login Handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const submitBtn = document.getElementById("submitBtn");

      // Frontend validation
      if (!email || !password) {
        showAlert("Please provide both email and password.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showAlert("Please enter a valid email address.");
        return;
      }

      try {
        if (submitBtn) submitBtn.disabled = true;
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          showAlert(data.message || "Invalid email or password.");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        // Save token and user information in localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        showAlert("Login successful! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 1000);
      } catch (err) {
        showAlert("Network error or server unreachable. Please try again.");
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
});
