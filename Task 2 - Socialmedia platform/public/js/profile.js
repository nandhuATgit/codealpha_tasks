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

  // Initial load
  loadProfile();
});
