document.addEventListener("DOMContentLoaded", () => {
  const alertBox = document.getElementById("alertBox");
  const displayName = document.getElementById("displayName");
  const displayUsername = document.getElementById("displayUsername");
  const displayBio = document.getElementById("displayBio");
  const profileImage = document.getElementById("profileImage");
  const postsCount = document.getElementById("postsCount");
  const followersCount = document.getElementById("followersCount");
  const followingCount = document.getElementById("followingCount");

  const ownerActions = document.getElementById("ownerActions");
  const toggleEditBtn = document.getElementById("toggleEditBtn");
  const followActions = document.getElementById("followActions");
  const followBtn = document.getElementById("followBtn");
  const editProfileSection = document.getElementById("editProfileSection");
  const editProfileForm = document.getElementById("editProfileForm");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const saveProfileBtn = document.getElementById("saveProfileBtn");

  const editName = document.getElementById("editName");
  const editBio = document.getElementById("editBio");
  const editProfileImage = document.getElementById("editProfileImage");

  const navAuth = document.getElementById("navAuth");
  const navProfile = document.getElementById("navProfile");
  const navCreatePost = document.getElementById("navCreatePost");

  // Get current logged-in user and token from localStorage
  const token = localStorage.getItem("token");
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    loggedInUser = null;
  }

  // Navbar login/logout toggle
  if (navAuth) {
    if (token && loggedInUser) {
      navAuth.textContent = "Logout";
      navAuth.href = "#";
      navAuth.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login.html";
      });
      if (navProfile) {
        navProfile.href = `/profile.html?username=${loggedInUser.username}`;
      }
      if (navCreatePost) {
        navCreatePost.href = "/create-post.html";
      }
    } else {
      navAuth.textContent = "Login";
      navAuth.href = "/login.html";
      if (navCreatePost) {
        navCreatePost.href = "/login.html";
      }
    }
  }

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

  // Determine target username from URL parameter or logged-in user
  const urlParams = new URLSearchParams(window.location.search);
  let targetUsername = urlParams.get("username");

  if (!targetUsername) {
    if (loggedInUser && loggedInUser.username) {
      targetUsername = loggedInUser.username;
    } else {
      showAlert("No user specified. Please log in or specify a username in the URL.");
      return;
    }
  }

  let currentProfileUser = null;

  // Fetch profile from backend
  async function loadProfile() {
    try {
      clearAlert();
      const res = await fetch(`/api/users/${encodeURIComponent(targetUsername)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert(data.message || "User not found.");
        return;
      }

      currentProfileUser = data.user;
      renderProfile(currentProfileUser);
    } catch (err) {
      showAlert("Failed to connect to server. Please try again.");
    }
  }

  function renderProfile(user) {
    displayName.textContent = user.name || "Unknown";
    displayUsername.textContent = `@${user.username}`;
    displayBio.textContent = user.bio && user.bio.trim() ? user.bio : "No bio provided yet.";

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username)}&background=2563eb&color=fff&size=100`;
    profileImage.src = user.profileImage && user.profileImage.trim() ? user.profileImage : defaultAvatar;
    profileImage.onerror = () => {
      profileImage.src = defaultAvatar;
    };

    postsCount.textContent = user.postsCount || 0;
    followersCount.textContent = user.followersCount || 0;
    followingCount.textContent = user.followingCount || 0;

    // Check if the viewer is the profile owner
    const isOwner = loggedInUser && token && loggedInUser.username.toLowerCase() === user.username.toLowerCase();
    if (isOwner) {
      ownerActions.style.display = "flex";
      if (followActions) followActions.style.display = "none";
      editName.value = user.name || "";
      editBio.value = user.bio || "";
      editProfileImage.value = user.profileImage || "";
    } else {
      ownerActions.style.display = "none";
      editProfileSection.style.display = "none";

      // Show follow/unfollow button for other profiles if logged in
      if (followActions && followBtn) {
        followActions.style.display = "flex";

        const currentUserId = loggedInUser ? (loggedInUser.id || loggedInUser._id) : null;
        const isFollowing =
          Boolean(currentUserId && Array.isArray(user.followers) && user.followers.some((f) => {
            const fId = typeof f === "object" && f !== null ? (f._id || f.id || f.toString()) : f.toString();
            return fId === currentUserId.toString();
          }));

        updateFollowButtonUI(isFollowing);
      }
    }

    // Load and render posts authored by this user
    loadUserPosts(user);
  }

  function updateFollowButtonUI(isFollowing) {
    if (!followBtn) return;
    if (isFollowing) {
      followBtn.textContent = "Unfollow";
      followBtn.className = "btn btn-secondary";
    } else {
      followBtn.textContent = "Follow";
      followBtn.className = "btn";
    }
  }

  // Handle follow / unfollow button clicks
  if (followBtn) {
    followBtn.addEventListener("click", async () => {
      if (!token || !loggedInUser) {
        showAlert("Please log in to follow users.");
        return;
      }

      if (!currentProfileUser || !currentProfileUser.id) {
        return;
      }

      const isCurrentlyFollowing = followBtn.textContent.trim().toLowerCase() === "unfollow";
      const actionUrl = isCurrentlyFollowing
        ? `/api/users/${currentProfileUser.id}/unfollow`
        : `/api/users/${currentProfileUser.id}/follow`;

      try {
        followBtn.disabled = true;
        const res = await fetch(actionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          showAlert(data.message || "Action failed.");
          return;
        }

        // Update counts live
        followersCount.textContent = data.followersCount;
        if (currentProfileUser) {
          currentProfileUser.followersCount = data.followersCount;
          // Update local followers array
          const currentUserId = loggedInUser.id || loggedInUser._id;
          if (data.isFollowing) {
            if (!Array.isArray(currentProfileUser.followers)) currentProfileUser.followers = [];
            currentProfileUser.followers.push(currentUserId);
          } else if (Array.isArray(currentProfileUser.followers)) {
            currentProfileUser.followers = currentProfileUser.followers.filter(
              (f) => f.toString() !== currentUserId.toString()
            );
          }
        }

        updateFollowButtonUI(data.isFollowing);
      } catch (err) {
        showAlert("Network error updating follow status.");
      } finally {
        followBtn.disabled = false;
      }
    });
  }

  // Toggle edit profile form
  if (toggleEditBtn) {
    toggleEditBtn.addEventListener("click", () => {
      const isHidden = editProfileSection.style.display === "none" || !editProfileSection.style.display;
      editProfileSection.style.display = isHidden ? "block" : "none";
      toggleEditBtn.textContent = isHidden ? "Close Edit" : "Edit Profile";
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      editProfileSection.style.display = "none";
      if (toggleEditBtn) toggleEditBtn.textContent = "Edit Profile";
      clearAlert();
    });
  }

  // Handle edit profile form submit
  if (editProfileForm) {
    editProfileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      if (!token) {
        showAlert("You must be logged in to edit your profile.");
        return;
      }

      const name = editName.value.trim();
      const bio = editBio.value.trim();
      const profileImageUrl = editProfileImage.value.trim();

      if (!name || name.length < 2 || name.length > 50) {
        showAlert("Name must be between 2 and 50 characters.");
        return;
      }

      if (bio.length > 160) {
        showAlert("Bio cannot exceed 160 characters.");
        return;
      }

      try {
        if (saveProfileBtn) saveProfileBtn.disabled = true;

        const res = await fetch("/api/users/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            bio,
            profileImage: profileImageUrl,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          showAlert(data.message || "Failed to update profile.");
          if (saveProfileBtn) saveProfileBtn.disabled = false;
          return;
        }

        showAlert("Profile updated successfully!", "success");

        // Update local storage user details
        if (loggedInUser) {
          loggedInUser.name = data.user.name;
          loggedInUser.bio = data.user.bio;
          loggedInUser.profileImage = data.user.profileImage;
          localStorage.setItem("user", JSON.stringify(loggedInUser));
        }

        // Re-render profile
        renderProfile(data.user);
        editProfileSection.style.display = "none";
        if (toggleEditBtn) toggleEditBtn.textContent = "Edit Profile";
        if (saveProfileBtn) saveProfileBtn.disabled = false;
      } catch (err) {
        showAlert("Network error while updating profile. Please try again.");
        if (saveProfileBtn) saveProfileBtn.disabled = false;
      }
    });
  }

  // Load and render posts authored by the profile user
  async function loadUserPosts(user) {
    const feedEl = document.getElementById("userPostsFeed");
    if (!feedEl) return;

    try {
      feedEl.innerHTML = `
        <div class="empty-feed-msg">
          <span class="spinner"></span>
          <p>Loading posts...</p>
        </div>
      `;

      const res = await fetch("/api/posts");
      const data = await res.json();

      if (!res.ok || !data.success) {
        feedEl.innerHTML = `<div class="empty-feed-msg"><p>Could not load user posts.</p></div>`;
        return;
      }

      const userPosts = (data.posts || []).filter((p) => {
        if (!p.user) return false;
        const postAuthorU = (p.user.username || "").toLowerCase();
        const profileU = (user.username || "").toLowerCase();
        return postAuthorU === profileU;
      });

      if (userPosts.length === 0) {
        feedEl.innerHTML = `
          <div class="empty-feed-msg">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>
            <h3>No posts yet</h3>
            <p>@${escapeHtml(user.username)} has not published any posts yet.</p>
          </div>
        `;
        return;
      }

      feedEl.innerHTML = "";
      userPosts.forEach((post) => {
        const card = document.createElement("article");
        card.className = "post-card";
        const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        let imageHtml = "";
        if (post.image && post.image.trim()) {
          imageHtml = `
            <div class="post-image-container">
              <img src="${escapeHtml(post.image.trim())}" alt="Post image" class="post-image" onerror="this.parentElement.style.display='none';" />
            </div>
          `;
        }

        const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
        const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;

        card.innerHTML = `
          <div class="post-header">
            <div class="post-author-link">
              <img src="${escapeHtml(profileImage.src)}" alt="${escapeHtml(user.name || user.username)}" class="post-author-avatar" onerror="this.src='https://via.placeholder.com/44?text=U'" />
              <div class="post-author-details">
                <span class="post-author-name">${escapeHtml(user.name || "User")}</span>
                <span class="post-meta">@${escapeHtml(user.username)} • ${formattedDate}</span>
              </div>
            </div>
          </div>
          <div class="post-content">${escapeHtml(post.content)}</div>
          ${imageHtml}
          <div class="post-actions">
            <span class="action-btn" style="cursor: default;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span class="action-count">${likesCount}</span>
              <span>Likes</span>
            </span>
            <span class="action-btn" style="cursor: default;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="action-count">${commentsCount}</span>
              <span>Comments</span>
            </span>
          </div>
        `;
        feedEl.appendChild(card);
      });
    } catch (err) {
      feedEl.innerHTML = `<div class="empty-feed-msg"><p>Failed to load user posts.</p></div>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial load
  loadProfile();
});
