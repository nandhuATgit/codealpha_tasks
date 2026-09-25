/**
 * Dashboard & Project Collaboration Management
 * Task 3 - Project Management Tool
 */

let currentUser = null;
let currentActiveProject = null;
let allProjectsList = [];
let activeTab = 'all';
let searchKeyword = '';

// Authenticated fetch wrapper
async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });

    // Handle token expiration or unauthorized access
    if (response.status === 401) {
      clearAuth();
      redirectToLogin();
      return null;
    }

    return response;
  } catch (error) {
    console.error('API Network Error:', error);
    throw error;
  }
}

function redirectToLogin() {
  window.location.href = 'login.html';
}

// User initials generator for avatars
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Format readable date
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Escape HTML for safety
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify User Authentication
  if (!isAuthenticated()) {
    redirectToLogin();
    return;
  }

  // 2. Setup Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearAuth();
      window.location.href = 'login.html';
    });
  }

  // 3. Load Current User Profile
  await verifyAndLoadUser();

  // 4. Load Projects List
  await loadProjects();

  // 5. Setup Event Listeners for Modals & Forms
  setupModalEvents();
  setupCreateProjectForm();
  setupEditProjectForm();
  setupAddMemberForm();
});

// Verify token with backend and update UI
async function verifyAndLoadUser() {
  try {
    const response = await authFetch('/api/auth/me');
    if (!response) return;

    const data = await response.json();
    if (!response.ok || !data.success) {
      clearAuth();
      redirectToLogin();
      return;
    }

    currentUser = data.user;
    setUser(currentUser); // keep local cache synced

    // Render user details in UI
    const welcomeNameEl = document.getElementById('welcomeUserName');
    if (welcomeNameEl) welcomeNameEl.textContent = currentUser.name;

    const userNavAvatarEl = document.getElementById('userNavAvatar');
    if (userNavAvatarEl) userNavAvatarEl.textContent = getInitials(currentUser.name);

    const userNavNameEl = document.getElementById('userNavName');
    if (userNavNameEl) userNavNameEl.textContent = currentUser.name;

    // Profile Modal fields
    const profileFullNameEl = document.getElementById('profileFullName');
    if (profileFullNameEl) profileFullNameEl.textContent = currentUser.name;

    const profileUsernameEl = document.getElementById('profileUsername');
    if (profileUsernameEl) profileUsernameEl.textContent = `@${currentUser.username}`;

    const profileEmailEl = document.getElementById('profileEmail');
    if (profileEmailEl) profileEmailEl.value = currentUser.email;

    const profileCreatedAtEl = document.getElementById('profileCreatedAt');
    if (profileCreatedAtEl) profileCreatedAtEl.value = formatDate(currentUser.createdAt);

    const profileAvatarEl = document.getElementById('profileAvatar');
    if (profileAvatarEl) profileAvatarEl.textContent = getInitials(currentUser.name);
  } catch (err) {
    console.error('Error fetching user profile:', err);
  }
}

// Profile modal controls
function openProfileModal() {
  openModal('profileModal');
}

// Load all projects for current user
async function loadProjects() {
  const container = document.getElementById('projectsContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted);">
      Loading your projects...
    </div>
  `;

  try {
    const response = await authFetch('/api/projects');
    if (!response) return;

    const data = await response.json();
    if (!response.ok || !data.success) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Failed to load projects</h3>
          <p>${escapeHtml(data.error || 'Please try refreshing the page.')}</p>
        </div>
      `;
      return;
    }

    allProjectsList = data.projects || [];

    // Calculate metrics
    const totalCount = allProjectsList.length;
    let ownedCount = 0;
    let joinedCount = 0;

    allProjectsList.forEach((proj) => {
      const isOwner = proj.owner && (proj.owner._id === currentUser.id || proj.owner === currentUser.id);
      if (isOwner) {
        ownedCount++;
      } else {
        joinedCount++;
      }
    });

    // Update Stats Numbers
    const statTotal = document.getElementById('statTotalProjects');
    if (statTotal) statTotal.textContent = totalCount;

    const statOwned = document.getElementById('statOwnedProjects');
    if (statOwned) statOwned.textContent = ownedCount;

    const statJoined = document.getElementById('statJoinedProjects');
    if (statJoined) statJoined.textContent = joinedCount;

    // Update Tab count badges
    const tabAll = document.getElementById('tabCountAll');
    if (tabAll) tabAll.textContent = totalCount;

    const tabOwned = document.getElementById('tabCountOwned');
    if (tabOwned) tabOwned.textContent = ownedCount;

    const tabJoined = document.getElementById('tabCountJoined');
    if (tabJoined) tabJoined.textContent = joinedCount;

    // Render filtered grid
    renderProjectsGrid();
  } catch (err) {
    console.error('Error fetching projects:', err);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Connection Error</h3>
        <p>Could not connect to the backend server. Please check your network and server status.</p>
      </div>
    `;
  }
}

// Render filtered project cards
function renderProjectsGrid() {
  const container = document.getElementById('projectsContainer');
  if (!container) return;

  let filtered = allProjectsList;

  // Filter by tab
  if (activeTab === 'owned') {
    filtered = filtered.filter(
      (p) => p.owner && (p.owner._id === currentUser.id || p.owner === currentUser.id)
    );
  } else if (activeTab === 'joined') {
    filtered = filtered.filter(
      (p) => !p.owner || (p.owner._id !== currentUser.id && p.owner !== currentUser.id)
    );
  }

  // Filter by search keyword
  if (searchKeyword) {
    filtered = filtered.filter((p) => {
      const nameMatch = p.name && p.name.toLowerCase().includes(searchKeyword);
      const descMatch = p.description && p.description.toLowerCase().includes(searchKeyword);
      return nameMatch || descMatch;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>No Projects Found</h3>
        <p>${searchKeyword ? 'No projects match your search.' : 'You do not have any projects in this section yet.'}</p>
        <button class="btn btn-primary" onclick="openCreateModal()">+ Create Project</button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((proj) => {
    const isOwner = proj.owner && (proj.owner._id === currentUser.id || proj.owner === currentUser.id);
    const memberCount = proj.members ? proj.members.length : 1;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div>
        <div class="project-card-header">
          <h3 class="project-card-title">${escapeHtml(proj.name)}</h3>
          <span class="role-badge ${isOwner ? 'role-owner' : 'role-member'}">
            ${isOwner ? 'Owner' : 'Member'}
          </span>
        </div>
        <p class="project-card-desc">${escapeHtml(proj.description || 'No description provided.')}</p>
      </div>
      <div>
        <div class="project-card-meta">
          <span>👥 ${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
          <span>Updated ${formatDate(proj.updatedAt)}</span>
        </div>
        <div class="project-card-actions">
          <a href="project.html?id=${proj._id}" class="btn btn-primary btn-sm" style="flex:1">
            Kanban Board &rarr;
          </a>
          <button class="btn btn-secondary btn-sm" title="Project Details & Members" onclick="openProjectDetails('${proj._id}')">
            Details
          </button>
          ${
            isOwner
              ? `<button class="btn btn-danger btn-sm" title="Delete Project" onclick="confirmDeleteProject('${proj._id}', '${escapeHtml(proj.name)}')">🗑️</button>`
              : ''
          }
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Tab switcher
function filterProjectsTab(tabName, btnElement) {
  activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderProjectsGrid();
}

// Search handler
function handleProjectSearch(val) {
  searchKeyword = (val || '').trim().toLowerCase();
  renderProjectsGrid();
}

// Modal System Helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function setupModalEvents() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });

    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    }

    const cancelBtns = overlay.querySelectorAll('[data-dismiss="modal"]');
    cancelBtns.forEach((btn) => {
      btn.addEventListener('click', () => overlay.classList.remove('active'));
    });
  });
}

// -------------------------------------------------------------
// CREATE PROJECT
// -------------------------------------------------------------
function openCreateModal() {
  document.getElementById('createProjectForm').reset();
  hideAlert('createProjectAlert');
  openModal('createProjectModal');
}

function setupCreateProjectForm() {
  const form = document.getElementById('createProjectForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('createProjectAlert');

    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!name) {
      showAlert('createProjectAlert', 'Please enter a project name.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      const response = await authFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });

      if (!response) return;
      const data = await response.json();

      if (!response.ok || !data.success) {
        showAlert('createProjectAlert', data.error || 'Failed to create project.');
        return;
      }

      closeModal('createProjectModal');
      await loadProjects();
    } catch (err) {
      showAlert('createProjectAlert', 'Server connection error.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Project';
    }
  });
}

// -------------------------------------------------------------
// OPEN & VIEW PROJECT DETAILS
// -------------------------------------------------------------
async function openProjectDetails(projectId) {
  try {
    const response = await authFetch(`/api/projects/${projectId}`);
    if (!response) return;

    const data = await response.json();
    if (!response.ok || !data.success) {
      alert(data.error || 'Failed to open project.');
      return;
    }

    currentActiveProject = data.project;
    renderProjectDetailsModal(currentActiveProject);
    openModal('projectDetailsModal');
  } catch (err) {
    console.error('Error fetching project detail:', err);
    alert('Error connecting to server.');
  }
}

function renderProjectDetailsModal(project) {
  const isOwner = project.owner && (project.owner._id === currentUser.id || project.owner === currentUser.id);

  // Set titles
  document.getElementById('detailModalTitle').textContent = project.name;
  document.getElementById('detailProjectName').textContent = project.name;
  document.getElementById('detailProjectDesc').textContent = project.description || 'No description provided.';
  document.getElementById('detailCreatedAt').textContent = formatDate(project.createdAt);
  document.getElementById('detailUpdatedAt').textContent = formatDate(project.updatedAt);

  const goToBoardBtn = document.getElementById('goToBoardBtn');
  if (goToBoardBtn) {
    goToBoardBtn.href = `project.html?id=${project._id}`;
  }

  // Owner badge & controls
  const roleBadge = document.getElementById('detailRoleBadge');
  if (roleBadge) {
    roleBadge.className = `role-badge ${isOwner ? 'role-owner' : 'role-member'}`;
    roleBadge.textContent = isOwner ? 'Project Owner' : 'Team Member';
  }

  // Owner specific controls visibility
  const editBtn = document.getElementById('editProjectBtn');
  const deleteBtn = document.getElementById('deleteProjectDetailBtn');
  const addMemberSection = document.getElementById('addMemberSection');

  if (editBtn) editBtn.style.display = isOwner ? 'inline-flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
  if (addMemberSection) addMemberSection.style.display = isOwner ? 'block' : 'none';

  // Render Owner info
  const ownerBox = document.getElementById('projectOwnerBox');
  if (ownerBox && project.owner) {
    ownerBox.innerHTML = `
      <div class="team-member-item">
        <div class="member-info">
          <div class="member-avatar-mini">${getInitials(project.owner.name)}</div>
          <div class="member-details-text">
            <strong>${escapeHtml(project.owner.name)} (Owner)</strong>
            <span>@${escapeHtml(project.owner.username)} • ${escapeHtml(project.owner.email)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Render Members List
  renderMembersList(project, isOwner);
}

function renderMembersList(project, isOwner) {
  const membersListEl = document.getElementById('membersList');
  if (!membersListEl) return;

  const members = project.members || [];
  membersListEl.innerHTML = '';

  if (members.length === 0) {
    membersListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No members in this project yet.</p>';
    return;
  }

  members.forEach((member) => {
    const isThisMemberOwner = project.owner && (project.owner._id === member._id || project.owner === member._id);
    const item = document.createElement('div');
    item.className = 'team-member-item';
    item.innerHTML = `
      <div class="member-info">
        <div class="member-avatar-mini">${getInitials(member.name)}</div>
        <div class="member-details-text">
          <strong>${escapeHtml(member.name)} ${isThisMemberOwner ? '<span style="color: var(--badge-owner-text); font-size:0.75rem;">(Owner)</span>' : ''}</strong>
          <span>@${escapeHtml(member.username)} • ${escapeHtml(member.email)}</span>
        </div>
      </div>
      <div>
        ${
          isOwner && !isThisMemberOwner
            ? `<button class="btn btn-danger btn-sm" onclick="removeMember('${project._id}', '${member._id}', '${escapeHtml(member.username)}')">Remove</button>`
            : ''
        }
      </div>
    `;
    membersListEl.appendChild(item);
  });
}

// -------------------------------------------------------------
// ADD MEMBER
// -------------------------------------------------------------
function setupAddMemberForm() {
  const form = document.getElementById('addMemberForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('addMemberAlert');

    if (!currentActiveProject) return;

    const input = document.getElementById('memberIdentifier');
    const identifier = input.value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!identifier) {
      showAlert('addMemberAlert', 'Please enter a username or email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const response = await authFetch(`/api/projects/${currentActiveProject._id}/members`, {
        method: 'POST',
        body: JSON.stringify({ identifier })
      });

      if (!response) return;
      const data = await response.json();

      if (!response.ok || !data.success) {
        showAlert('addMemberAlert', data.error || 'Failed to add member.');
        return;
      }

      currentActiveProject = data.project;
      input.value = '';
      showAlert('addMemberAlert', data.message || 'Member added!', 'success');
      renderProjectDetailsModal(currentActiveProject);
      await loadProjects(); // refresh project cards count
    } catch (err) {
      showAlert('addMemberAlert', 'Connection error while adding member.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Member';
    }
  });
}

// -------------------------------------------------------------
// REMOVE MEMBER
// -------------------------------------------------------------
async function removeMember(projectId, memberUserId, username) {
  if (!confirm(`Are you sure you want to remove @${username} from this project?`)) {
    return;
  }

  try {
    const response = await authFetch(`/api/projects/${projectId}/members/${memberUserId}`, {
      method: 'DELETE'
    });

    if (!response) return;
    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.error || 'Failed to remove member.');
      return;
    }

    currentActiveProject = data.project;
    renderProjectDetailsModal(currentActiveProject);
    await loadProjects();
  } catch (err) {
    console.error('Error removing member:', err);
    alert('Error connecting to server.');
  }
}

// -------------------------------------------------------------
// EDIT PROJECT
// -------------------------------------------------------------
function openEditModal() {
  if (!currentActiveProject) return;

  document.getElementById('editProjectName').value = currentActiveProject.name;
  document.getElementById('editProjectDesc').value = currentActiveProject.description || '';
  hideAlert('editProjectAlert');
  openModal('editProjectModal');
}

function setupEditProjectForm() {
  const form = document.getElementById('editProjectForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('editProjectAlert');

    if (!currentActiveProject) return;

    const name = document.getElementById('editProjectName').value.trim();
    const description = document.getElementById('editProjectDesc').value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!name) {
      showAlert('editProjectAlert', 'Project name is required.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const response = await authFetch(`/api/projects/${currentActiveProject._id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description })
      });

      if (!response) return;
      const data = await response.json();

      if (!response.ok || !data.success) {
        showAlert('editProjectAlert', data.error || 'Failed to update project.');
        return;
      }

      currentActiveProject = data.project;
      renderProjectDetailsModal(currentActiveProject);
      closeModal('editProjectModal');
      await loadProjects();
    } catch (err) {
      showAlert('editProjectAlert', 'Error connecting to server.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });
}

// -------------------------------------------------------------
// DELETE PROJECT
// -------------------------------------------------------------
async function confirmDeleteProject(projectId, projectName) {
  if (!confirm(`Are you sure you want to permanently delete "${projectName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await authFetch(`/api/projects/${projectId}`, {
      method: 'DELETE'
    });

    if (!response) return;
    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.error || 'Failed to delete project.');
      return;
    }

    closeModal('projectDetailsModal');
    await loadProjects();
  } catch (err) {
    console.error('Error deleting project:', err);
    alert('Error connecting to server.');
  }
}

// Delete from within project details modal
function deleteActiveProject() {
  if (currentActiveProject) {
    confirmDeleteProject(currentActiveProject._id, currentActiveProject.name);
  }
}
