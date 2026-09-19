document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    loggedInUser = null;
  }


  // Render Current User Sidebar Information (index.html)
  const sidebarLoggedIn = document.getElementById("sidebarLoggedIn");
  const sidebarLoggedOut = document.getElementById("sidebarLoggedOut");
  const quickCreateCard = document.getElementById("quickCreateCard");

  if (sidebarLoggedIn && sidebarLoggedOut) {
    if (token && loggedInUser) {
      sidebarLoggedIn.style.display = "block";
      sidebarLoggedOut.style.display = "none";
      if (quickCreateCard) quickCreateCard.style.display = "flex";

      const sidebarAvatar = document.getElementById("sidebarAvatar");
      const sidebarName = document.getElementById("sidebarName");
      const sidebarUsername = document.getElementById("sidebarUsername");
      const sidebarBio = document.getElementById("sidebarBio");
      const quickCreateAvatar = document.getElementById("quickCreateAvatar");

      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        loggedInUser.name || loggedInUser.username
      )}&background=2563eb&color=fff&size=88`;

      if (sidebarAvatar) {
        sidebarAvatar.src = loggedInUser.profileImage && loggedInUser.profileImage.trim()
          ? loggedInUser.profileImage
          : defaultAvatar;
        sidebarAvatar.onerror = () => { sidebarAvatar.src = defaultAvatar; };
      }

      if (quickCreateAvatar) {
        quickCreateAvatar.src = loggedInUser.profileImage && loggedInUser.profileImage.trim()
          ? loggedInUser.profileImage
          : defaultAvatar;
        quickCreateAvatar.onerror = () => { quickCreateAvatar.src = defaultAvatar; };
      }

      if (sidebarName) sidebarName.textContent = loggedInUser.name || "User";
      if (sidebarUsername) sidebarUsername.textContent = `@${loggedInUser.username}`;
      if (sidebarBio) {
        sidebarBio.textContent = loggedInUser.bio && loggedInUser.bio.trim()
          ? loggedInUser.bio
          : "No bio provided";
      }
    } else {
      sidebarLoggedIn.style.display = "none";
      sidebarLoggedOut.style.display = "block";
      if (quickCreateCard) quickCreateCard.style.display = "none";
    }
  }

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

  // Handle Post Creation (create-post.html)
  const createPostForm = document.getElementById("createPostForm");
  if (createPostForm) {
    if (!token) {
      showAlert("You must be logged in to create a post. Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1500);
      return;
    }

    createPostForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const content = document.getElementById("content").value.trim();
      const image = document.getElementById("image").value.trim();
      const submitPostBtn = document.getElementById("submitPostBtn");

      if (!content) {
        showAlert("Post content is required.");
        return;
      }

      if (content.length > 1000) {
        showAlert("Post content cannot exceed 1000 characters.");
        return;
      }

      try {
        if (submitPostBtn) submitPostBtn.disabled = true;

        const res = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content, image }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          showAlert(data.message || "Failed to create post.");
          if (submitPostBtn) submitPostBtn.disabled = false;
          return;
        }

        showAlert("Post created successfully! Redirecting to feed...", "success");
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 1000);
      } catch (err) {
        showAlert("Network error. Please try again.");
        if (submitPostBtn) submitPostBtn.disabled = false;
      }
    });
  }

  // Handle Posts Feed Display (index.html)
  const postsFeed = document.getElementById("postsFeed");
  const tabAllPosts = document.getElementById("tabAllPosts");
  const tabFollowing = document.getElementById("tabFollowing");

  let currentFeedType = "all"; // "all" or "following"

  if (tabAllPosts && tabFollowing) {
    tabAllPosts.addEventListener("click", () => {
      if (currentFeedType === "all") return;
      currentFeedType = "all";
      tabAllPosts.classList.add("active");
      tabFollowing.classList.remove("active");
      loadFeed();
    });

    tabFollowing.addEventListener("click", () => {
      if (currentFeedType === "following") return;
      if (!token) {
        alert("Please log in to view posts from users you follow.");
        return;
      }
      currentFeedType = "following";
      tabFollowing.classList.add("active");
      tabAllPosts.classList.remove("active");
      loadFeed();
    });
  }

  if (postsFeed) {
    loadFeed();
  }

  async function loadFeed() {
    try {
      clearAlert();
      postsFeed.innerHTML = `
        <div class="empty-feed-msg">
          <span class="spinner"></span>
          <span>Loading feed updates...</span>
        </div>
      `;

      let url = "/api/posts";
      const headers = {};

      if (currentFeedType === "following") {
        url = "/api/posts/feed";
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok || !data.success) {
        postsFeed.innerHTML = `<div class="empty-feed-msg">${data.message || "Failed to load posts."}</div>`;
        return;
      }

      renderPosts(data.posts || []);
    } catch (err) {
      postsFeed.innerHTML = `<div class="empty-feed-msg">Failed to connect to server.</div>`;
    }
  }

  function renderPosts(posts) {
    if (!posts || posts.length === 0) {
      if (currentFeedType === "following") {
        postsFeed.innerHTML = `
          <div class="empty-feed-msg">
            <div style="font-size:32px; margin-bottom:4px;">👥</div>
            <strong style="font-size:16px; color:var(--text-main);">No posts from followed users</strong>
            <span>You're not following anyone yet, or they haven't shared a post. Explore "🌟 Explore All" to find creators!</span>
          </div>
        `;
      } else {
        postsFeed.innerHTML = `
          <div class="empty-feed-msg">
            <div style="font-size:32px; margin-bottom:4px;">✨</div>
            <strong style="font-size:16px; color:var(--text-main);">No posts yet</strong>
            <span>Be the first to share an update or story with the community!</span>
          </div>
        `;
      }
      return;
    }

    postsFeed.innerHTML = "";
    posts.forEach((post) => {
      const postCard = document.createElement("article");
      postCard.className = "post-card";
      postCard.id = `post-${post._id}`;

      const author = post.user || {};
      const authorName = author.name || "Unknown";
      const authorUsername = author.username || "anonymous";
      const authorAvatar =
        author.profileImage && author.profileImage.trim()
          ? author.profileImage
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=2563eb&color=fff&size=88`;

      const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Check if logged-in user is the owner
      const isOwner =
        loggedInUser &&
        token &&
        (author._id === loggedInUser.id || author._id === loggedInUser._id || author.username === loggedInUser.username);

      let imageHtml = "";
      if (post.image && post.image.trim()) {
        imageHtml = `
          <div class="post-image-container">
            <img src="${escapeHtml(post.image.trim())}" alt="Post image" class="post-image" onerror="this.parentElement.style.display='none';" />
          </div>
        `;
      }

      let deleteButtonHtml = "";
      if (isOwner) {
        deleteButtonHtml = `
          <button class="btn-delete-post" data-post-id="${post._id}" title="Delete post">🗑️ Delete</button>
        `;
      }

      const likeCount = Array.isArray(post.likes) ? post.likes.length : 0;
      const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;

      // Check if logged-in user has liked this post
      const currentUserId = loggedInUser ? (loggedInUser.id || loggedInUser._id) : null;
      const hasLiked =
        Boolean(currentUserId && Array.isArray(post.likes) && post.likes.some((like) => {
          const lId = typeof like === "object" && like !== null ? (like._id || like.id || like.toString()) : like.toString();
          return lId === currentUserId.toString();
        }));

      postCard.innerHTML = `
        <div class="post-header">
          <a href="/profile.html?username=${encodeURIComponent(authorUsername)}" class="post-author-link">
            <img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(authorName)}" class="post-author-avatar" onerror="this.src='https://via.placeholder.com/44?text=U'" />
            <div class="post-author-details">
              <span class="post-author-name">${escapeHtml(authorName)}</span>
              <span class="post-meta">@${escapeHtml(authorUsername)} • ${escapeHtml(formattedDate)}</span>
            </div>
          </a>
          ${deleteButtonHtml}
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${imageHtml}
        <div class="post-actions">
          <button class="action-btn like-btn ${hasLiked ? "liked" : ""}" data-post-id="${post._id}" type="button" title="${hasLiked ? "Unlike" : "Like"}">
            <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <span class="action-count" id="likeCount-${post._id}">${likeCount}</span>
            <span class="like-label">${hasLiked ? "Liked" : "Like"}</span>
          </button>
          <button class="action-btn comment-toggle-btn" data-post-id="${post._id}" type="button" title="Comment">
            <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <span class="action-count" id="commentCount-${post._id}">${commentCount}</span>
            <span>Comments</span>
          </button>
        </div>
        <div class="comments-section" id="commentsSection-${post._id}">
          <form class="comment-form" data-post-id="${post._id}">
            <input type="text" class="comment-input" placeholder="${token ? "Write a comment..." : "Log in to comment"}" ${token ? "" : "disabled"} required maxlength="500" />
            <button type="submit" class="btn-comment-submit" ${token ? "" : "disabled"}>Comment</button>
          </form>
          <div class="comments-list" id="commentsList-${post._id}">
            <div style="font-size:12px; color:#9ca3af;">Loading comments...</div>
          </div>
        </div>
      `;

      postsFeed.appendChild(postCard);

      // Load comments for this post
      loadComments(post._id);
    });

    // Attach like toggle handlers
    document.querySelectorAll(".like-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const button = e.currentTarget;
        const postId = button.getAttribute("data-post-id");

        if (!token) {
          alert("Please log in to like posts.");
          return;
        }

        try {
          button.disabled = true;
          const res = await fetch(`/api/posts/${postId}/like`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json();
          if (res.ok && data.success) {
            const countEl = document.getElementById(`likeCount-${postId}`);
            const labelEl = button.querySelector(".like-label");

            if (countEl) countEl.textContent = data.likeCount;
            if (data.isLiked) {
              button.classList.add("liked");
              button.title = "Unlike";
              if (labelEl) labelEl.textContent = "Liked";
            } else {
              button.classList.remove("liked");
              button.title = "Like";
              if (labelEl) labelEl.textContent = "Like";
            }
          } else {
            alert(data.message || "Could not update like.");
          }
        } catch (err) {
          alert("Network error updating like.");
        } finally {
          button.disabled = false;
        }
      });
    });

    // Attach post delete handlers
    document.querySelectorAll(".btn-delete-post").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const postId = e.target.getAttribute("data-post-id");
        if (!confirm("Are you sure you want to delete this post?")) return;

        try {
          const res = await fetch(`/api/posts/${postId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const card = document.getElementById(`post-${postId}`);
            if (card) card.remove();
            if (postsFeed.children.length === 0) {
              postsFeed.innerHTML = `<div class="empty-feed-msg">No posts yet.</div>`;
            }
          } else {
            alert(data.message || "Could not delete post.");
          }
        } catch (err) {
          alert("Network error deleting post.");
        }
      });
    });

    // Attach comment submit handlers
    document.querySelectorAll(".comment-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!token) {
          alert("Please log in to add a comment.");
          return;
        }

        const postId = form.getAttribute("data-post-id");
        const input = form.querySelector(".comment-input");
        const submitBtn = form.querySelector(".btn-comment-submit");
        const text = input.value.trim();

        if (!text) return;

        try {
          submitBtn.disabled = true;
          const res = await fetch("/api/comments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ postId, text }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            input.value = "";
            // Prepend new comment to list
            prependComment(postId, data.comment);
            // Update comment count
            const countEl = document.getElementById(`commentCount-${postId}`);
            if (countEl) {
              countEl.textContent = parseInt(countEl.textContent || "0", 10) + 1;
            }
          } else {
            alert(data.message || "Could not post comment.");
          }
        } catch (err) {
          alert("Network error while submitting comment.");
        } finally {
          submitBtn.disabled = false;
        }
      });
    });
  }

  // Load comments for a post
  async function loadComments(postId) {
    const listEl = document.getElementById(`commentsList-${postId}`);
    if (!listEl) return;

    try {
      const res = await fetch(`/api/comments/${postId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        listEl.innerHTML = `<div style="font-size:12px; color:#9ca3af;">Unable to load comments.</div>`;
        return;
      }

      // Update count
      const countEl = document.getElementById(`commentCount-${postId}`);
      if (countEl) {
        countEl.textContent = data.comments.length;
      }

      if (data.comments.length === 0) {
        listEl.innerHTML = `<div style="font-size:12px; color:#9ca3af;">No comments yet.</div>`;
        return;
      }

      listEl.innerHTML = "";
      data.comments.forEach((c) => {
        listEl.appendChild(createCommentElement(postId, c));
      });
    } catch (err) {
      listEl.innerHTML = `<div style="font-size:12px; color:#9ca3af;">Failed to load comments.</div>`;
    }
  }

  function createCommentElement(postId, comment) {
    const commentItem = document.createElement("div");
    commentItem.className = "comment-item";
    commentItem.id = `comment-${comment._id}`;

    const author = comment.user || {};
    const authorName = author.name || "Unknown";
    const authorUsername = author.username || "user";
    const authorAvatar =
      author.profileImage && author.profileImage.trim()
        ? author.profileImage
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=2563eb&color=fff&size=64`;

    const isCommentOwner =
      loggedInUser &&
      token &&
      (author._id === loggedInUser.id || author._id === loggedInUser._id || author.username === loggedInUser.username);

    let deleteBtnHtml = "";
    if (isCommentOwner) {
      deleteBtnHtml = `<button class="btn-delete-comment" data-comment-id="${comment._id}" data-post-id="${postId}" title="Delete comment">✕ Delete</button>`;
    }

    const formattedTime = new Date(comment.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    commentItem.innerHTML = `
      <img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(authorName)}" class="comment-avatar" onerror="this.src='https://via.placeholder.com/32?text=U'" />
      <div class="comment-body">
        <div class="comment-header">
          <div>
            <a href="/profile.html?username=${encodeURIComponent(authorUsername)}" class="comment-author-name">${escapeHtml(authorName)}</a>
            <span class="comment-username">@${escapeHtml(authorUsername)}</span>
            <span class="comment-date">• ${escapeHtml(formattedTime)}</span>
          </div>
          ${deleteBtnHtml}
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
      </div>
    `;

    // Attach delete handler if owner
    const delBtn = commentItem.querySelector(".btn-delete-comment");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this comment?")) return;

        try {
          const res = await fetch(`/api/comments/${comment._id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.success) {
            commentItem.remove();
            const countEl = document.getElementById(`commentCount-${postId}`);
            if (countEl) {
              const current = parseInt(countEl.textContent || "1", 10);
              countEl.textContent = Math.max(0, current - 1);
            }
            const listEl = document.getElementById(`commentsList-${postId}`);
            if (listEl && listEl.children.length === 0) {
              listEl.innerHTML = `<div style="font-size:12px; color:#9ca3af;">No comments yet.</div>`;
            }
          } else {
            alert(data.message || "Failed to delete comment.");
          }
        } catch (err) {
          alert("Network error deleting comment.");
        }
      });
    }

    return commentItem;
  }

  function prependComment(postId, comment) {
    const listEl = document.getElementById(`commentsList-${postId}`);
    if (!listEl) return;

    // Remove empty placeholder message if present
    if (listEl.children.length === 1 && !listEl.children[0].classList.contains("comment-item")) {
      listEl.innerHTML = "";
    }

    const commentEl = createCommentElement(postId, comment);
    listEl.insertBefore(commentEl, listEl.firstChild);
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
});
