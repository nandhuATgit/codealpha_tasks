/**
 * Kanban Board & Task Collaboration
 * Task 3 - Project Management Tool
 */

let projectId = null;
let currentProject = null;
let currentUser = null;
let allTasks = [];
let editingTaskId = null;

// Authenticated fetch helper
async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      clearAuth();
      window.location.href = 'login.html';
      return null;
    }
    return response;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// User initials helper
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Escape HTML helper
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Format readable date
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

// Check if due date is overdue
function isOverdue(dueDateString, status) {
  if (!dueDateString || status === 'done') return false;
  const due = new Date(dueDateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

// Modal helper
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// ==============================================================
// INITIALIZATION
// ==============================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Get project ID from URL query parameters
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('id');

  if (!projectId) {
    alert('No project specified. Returning to dashboard.');
    window.location.href = 'dashboard.html';
    return;
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearAuth();
      window.location.href = 'login.html';
    });
  }

  // Load current user profile
  await loadCurrentUser();

  // Load Project & Tasks
  await loadProjectData();
  await loadTasks();

  // Setup Event Listeners
  setupModals();
  setupFilterEvents();
  setupDragAndDrop();
  setupCreateTaskForm();
  setupEditTaskForm();
  setupTeamInviteForm();
});

// Load authenticated user
async function loadCurrentUser() {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res) return;
    const data = await res.json();
    if (res.ok && data.success) {
      currentUser = data.user;
      setUser(currentUser);
      document.getElementById('userNavName').textContent = currentUser.name;
      document.getElementById('userNavAvatar').textContent = getInitials(currentUser.name);
    }
  } catch (err) {
    console.error('Error fetching current user:', err);
  }
}

// Load Project metadata & team members
async function loadProjectData() {
  try {
    const res = await authFetch(`/api/projects/${projectId}`);
    if (!res) return;

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Project not found or access denied.');
      window.location.href = 'dashboard.html';
      return;
    }

    currentProject = data.project;

    // Update Header
    document.title = `${currentProject.name} | Kanban Board`;
    document.getElementById('breadcrumbProjectName').textContent = currentProject.name;
    document.getElementById('projectHeaderTitle').textContent = currentProject.name;
    document.getElementById('projectHeaderDesc').textContent = currentProject.description || 'No description provided.';

    const isOwner = currentProject.owner && (currentProject.owner._id === currentUser.id || currentProject.owner === currentUser.id);
    const roleBadge = document.getElementById('projectRoleBadge');
    roleBadge.className = `role-badge ${isOwner ? 'role-owner' : 'role-member'}`;
    roleBadge.textContent = isOwner ? 'Project Owner' : 'Team Member';

    const memberCount = currentProject.members ? currentProject.members.length : 1;
    document.getElementById('teamCountBadge').textContent = memberCount;

    // Populate Member dropdowns in forms & filters
    populateMemberOptions();
  } catch (err) {
    console.error('Error loading project:', err);
  }
}

// Populate Member options in filters and modals
function populateMemberOptions() {
  const members = currentProject.members || [];

  const filterSelect = document.getElementById('filterAssigned');
  const createSelect = document.getElementById('taskAssignedTo');
  const editSelect = document.getElementById('editTaskAssignedTo');

  // Keep first default options
  filterSelect.innerHTML = '<option value="all">All Assignees</option><option value="unassigned">Unassigned</option>';
  createSelect.innerHTML = '<option value="">Unassigned</option>';
  editSelect.innerHTML = '<option value="">Unassigned</option>';

  members.forEach((m) => {
    const optFilter = document.createElement('option');
    optFilter.value = m._id;
    optFilter.textContent = `${m.name} (@${m.username})`;
    filterSelect.appendChild(optFilter);

    const optCreate = document.createElement('option');
    optCreate.value = m._id;
    optCreate.textContent = `${m.name} (@${m.username})`;
    createSelect.appendChild(optCreate);

    const optEdit = document.createElement('option');
    optEdit.value = m._id;
    optEdit.textContent = `${m.name} (@${m.username})`;
    editSelect.appendChild(optEdit);
  });
}

// Load tasks for project
async function loadTasks() {
  try {
    const res = await authFetch(`/api/tasks?project=${projectId}`);
    if (!res) return;

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('Failed to load tasks:', data.error);
      return;
    }

    allTasks = data.tasks || [];
    renderKanbanBoard();
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

// ==============================================================
// RENDER KANBAN BOARD
// ==============================================================
function renderKanbanBoard() {
  const colTodo = document.getElementById('col-todo');
  const colInProgress = document.getElementById('col-in-progress');
  const colDone = document.getElementById('col-done');

  colTodo.innerHTML = '';
  colInProgress.innerHTML = '';
  colDone.innerHTML = '';

  // Get active filters
  const searchTerm = document.getElementById('taskSearchInput').value.trim().toLowerCase();
  const priorityFilter = document.getElementById('filterPriority').value;
  const assignedFilter = document.getElementById('filterAssigned').value;
  const statusFilter = document.getElementById('filterStatus').value;

  // Filter tasks
  const filteredTasks = allTasks.filter((task) => {
    // Search filter
    if (searchTerm) {
      const matchTitle = task.title && task.title.toLowerCase().includes(searchTerm);
      const matchDesc = task.description && task.description.toLowerCase().includes(searchTerm);
      if (!matchTitle && !matchDesc) return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }

    // Assignee filter
    if (assignedFilter === 'unassigned') {
      if (task.assignedTo !== null) return false;
    } else if (assignedFilter !== 'all') {
      const assignedId = task.assignedTo ? (task.assignedTo._id || task.assignedTo) : null;
      if (assignedId !== assignedFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    return true;
  });

  let countTodo = 0;
  let countInProgress = 0;
  let countDone = 0;

  filteredTasks.forEach((task) => {
    const card = createTaskCardElement(task);

    if (task.status === 'todo') {
      colTodo.appendChild(card);
      countTodo++;
    } else if (task.status === 'in-progress') {
      colInProgress.appendChild(card);
      countInProgress++;
    } else if (task.status === 'done') {
      colDone.appendChild(card);
      countDone++;
    }
  });

  // Empty state placeholders
  if (countTodo === 0) colTodo.innerHTML = '<div class="column-empty">No tasks in To Do</div>';
  if (countInProgress === 0) colInProgress.innerHTML = '<div class="column-empty">No tasks In Progress</div>';
  if (countDone === 0) colDone.innerHTML = '<div class="column-empty">No tasks Completed</div>';

  // Update counters
  document.getElementById('count-todo').textContent = countTodo;
  document.getElementById('count-in-progress').textContent = countInProgress;
  document.getElementById('count-done').textContent = countDone;
}

// Generate individual Task Card DOM Element
function createTaskCardElement(task) {
  const isOwner = currentProject.owner && (currentProject.owner._id === currentUser.id || currentProject.owner === currentUser.id);
  const isCreator = task.createdBy && (task.createdBy._id === currentUser.id || task.createdBy === currentUser.id);
  const canDelete = isOwner || isCreator;

  const card = document.createElement('div');
  card.className = 'task-card';
  card.setAttribute('draggable', 'true');
  card.dataset.taskId = task._id;
  card.dataset.status = task.status;

  // Due date check
  const hasDueDate = Boolean(task.dueDate);
  const overdue = hasDueDate && isOverdue(task.dueDate, task.status);

  // Assignee formatting
  const assigned = task.assignedTo;
  const assignedName = assigned ? assigned.name : 'Unassigned';
  const assignedInitials = assigned ? getInitials(assigned.name) : '?';

  card.innerHTML = `
    <div class="task-card-header">
      <h4 class="task-title">${escapeHtml(task.title)}</h4>
      <div class="task-actions">
        <button class="btn-icon" title="Edit Task" onclick="openEditTaskModal('${task._id}')">✏️</button>
        ${
          canDelete
            ? `<button class="btn-icon btn-icon-danger" title="Delete Task" onclick="confirmDeleteTask('${task._id}')">🗑️</button>`
            : ''
        }
      </div>
    </div>

    ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

    <div class="task-tags">
      <span class="badge-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
      ${
        hasDueDate
          ? `<span class="badge-due-date ${overdue ? 'overdue' : ''}">
              📅 ${formatDate(task.dueDate)} ${overdue ? '(Overdue)' : ''}
            </span>`
          : ''
      }
    </div>

    <div class="task-card-footer">
      <div class="task-assigned-user" title="Assigned to ${escapeHtml(assignedName)}">
        <div class="mini-avatar" style="${!assigned ? 'opacity: 0.5' : ''}">${assignedInitials}</div>
        <span style="font-size: 0.78rem;">${escapeHtml(assignedName)}</span>
      </div>

      <!-- Quick status select control (fallback / accessibility) -->
      <div>
        <select class="task-move-select" onchange="quickMoveTask('${task._id}', this.value)" title="Move status">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
    </div>
  `;

  // Attach drag events to card
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

// ==============================================================
// DRAG & DROP HANDLING (HTML5 Native)
// ==============================================================
function setupDragAndDrop() {
  const columns = document.querySelectorAll('.column-body');

  columns.forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain');
      const targetStatus = col.dataset.status;

      if (!taskId || !targetStatus) return;

      const task = allTasks.find((t) => t._id === taskId);
      if (!task || task.status === targetStatus) return;

      // Optimistically update locally
      const oldStatus = task.status;
      task.status = targetStatus;
      renderKanbanBoard();

      // Send status update to API
      try {
        const res = await authFetch(`/api/tasks/${taskId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: targetStatus })
        });

        if (!res) return;
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Revert if API failed
          task.status = oldStatus;
          renderKanbanBoard();
          alert(data.error || 'Failed to update task status.');
        }
      } catch (err) {
        console.error('Drag status update error:', err);
        task.status = oldStatus;
        renderKanbanBoard();
      }
    });
  });
}

// Quick move via selector dropdown
async function quickMoveTask(taskId, newStatus) {
  const task = allTasks.find((t) => t._id === taskId);
  if (!task || task.status === newStatus) return;

  const oldStatus = task.status;
  task.status = newStatus;
  renderKanbanBoard();

  try {
    const res = await authFetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });

    if (!res) return;
    const data = await res.json();
    if (!res.ok || !data.success) {
      task.status = oldStatus;
      renderKanbanBoard();
      alert(data.error || 'Failed to update task status.');
    }
  } catch (err) {
    task.status = oldStatus;
    renderKanbanBoard();
  }
}

// ==============================================================
// FILTERS SETUP
// ==============================================================
function setupFilterEvents() {
  document.getElementById('taskSearchInput').addEventListener('input', renderKanbanBoard);
  document.getElementById('filterPriority').addEventListener('change', renderKanbanBoard);
  document.getElementById('filterAssigned').addEventListener('change', renderKanbanBoard);
  document.getElementById('filterStatus').addEventListener('change', renderKanbanBoard);

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('taskSearchInput').value = '';
    document.getElementById('filterPriority').value = 'all';
    document.getElementById('filterAssigned').value = 'all';
    document.getElementById('filterStatus').value = 'all';
    renderKanbanBoard();
  });
}

// ==============================================================
// CREATE TASK
// ==============================================================
function openCreateTaskModal() {
  document.getElementById('createTaskForm').reset();
  hideAlert('createTaskAlert');
  openModal('createTaskModal');
}

function setupCreateTaskForm() {
  const form = document.getElementById('createTaskForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('createTaskAlert');

    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const status = document.getElementById('taskStatus').value;
    const priority = document.getElementById('taskPriority').value;
    const assignedTo = document.getElementById('taskAssignedTo').value || null;
    const dueDate = document.getElementById('taskDueDate').value || null;

    if (!title) {
      showAlert('createTaskAlert', 'Task title is required.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          project: projectId,
          title,
          description,
          status,
          priority,
          assignedTo,
          dueDate
        })
      });

      if (!res) return;
      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert('createTaskAlert', data.error || 'Failed to create task.');
        return;
      }

      allTasks.unshift(data.task);
      renderKanbanBoard();
      closeModal('createTaskModal');
    } catch (err) {
      showAlert('createTaskAlert', 'Connection error while creating task.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Task';
    }
  });
}

// ==============================================================
// EDIT TASK
// ==============================================================
function openEditTaskModal(taskId) {
  const task = allTasks.find((t) => t._id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskDescription').value = task.description || '';
  document.getElementById('editTaskStatus').value = task.status;
  document.getElementById('editTaskPriority').value = task.priority;

  const assignedVal = task.assignedTo ? (task.assignedTo._id || task.assignedTo) : '';
  document.getElementById('editTaskAssignedTo').value = assignedVal;

  if (task.dueDate) {
    const d = new Date(task.dueDate);
    document.getElementById('editTaskDueDate').value = d.toISOString().split('T')[0];
  } else {
    document.getElementById('editTaskDueDate').value = '';
  }

  // Delete button authorization
  const isOwner = currentProject.owner && (currentProject.owner._id === currentUser.id || currentProject.owner === currentUser.id);
  const isCreator = task.createdBy && (task.createdBy._id === currentUser.id || task.createdBy === currentUser.id);
  const deleteBtn = document.getElementById('deleteTaskBtn');

  if (deleteBtn) {
    deleteBtn.style.display = isOwner || isCreator ? 'inline-flex' : 'none';
    deleteBtn.onclick = () => confirmDeleteTask(task._id);
  }

  hideAlert('editTaskAlert');
  openModal('editTaskModal');
}

function setupEditTaskForm() {
  const form = document.getElementById('editTaskForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('editTaskAlert');

    if (!editingTaskId) return;

    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const status = document.getElementById('editTaskStatus').value;
    const priority = document.getElementById('editTaskPriority').value;
    const assignedTo = document.getElementById('editTaskAssignedTo').value || null;
    const dueDate = document.getElementById('editTaskDueDate').value || null;

    if (!title) {
      showAlert('editTaskAlert', 'Task title cannot be empty.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const res = await authFetch(`/api/tasks/${editingTaskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          status,
          priority,
          assignedTo,
          dueDate
        })
      });

      if (!res) return;
      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert('editTaskAlert', data.error || 'Failed to update task.');
        return;
      }

      // Update local task
      const index = allTasks.findIndex((t) => t._id === editingTaskId);
      if (index !== -1) {
        allTasks[index] = data.task;
      }

      renderKanbanBoard();
      closeModal('editTaskModal');
    } catch (err) {
      showAlert('editTaskAlert', 'Error connecting to server.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });
}

// ==============================================================
// DELETE TASK
// ==============================================================
async function confirmDeleteTask(taskId) {
  const task = allTasks.find((t) => t._id === taskId);
  const taskTitle = task ? task.title : 'this task';

  if (!confirm(`Are you sure you want to delete "${taskTitle}"?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });

    if (!res) return;
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to delete task.');
      return;
    }

    allTasks = allTasks.filter((t) => t._id !== taskId);
    renderKanbanBoard();
    closeModal('editTaskModal');
  } catch (err) {
    alert('Failed to connect to server.');
  }
}

// ==============================================================
// TEAM MANAGEMENT MODAL (from Kanban board)
// ==============================================================
function openTeamModal() {
  renderTeamModal();
  openModal('projectTeamModal');
}

function renderTeamModal() {
  const isOwner = currentProject.owner && (currentProject.owner._id === currentUser.id || currentProject.owner === currentUser.id);

  // Render Owner
  const ownerBox = document.getElementById('teamOwnerBox');
  if (ownerBox && currentProject.owner) {
    ownerBox.innerHTML = `
      <div class="team-member-item">
        <div class="member-info">
          <div class="member-avatar-mini">${getInitials(currentProject.owner.name)}</div>
          <div class="member-details-text">
            <strong>${escapeHtml(currentProject.owner.name)} (Owner)</strong>
            <span>@${escapeHtml(currentProject.owner.username)} • ${escapeHtml(currentProject.owner.email)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Render Members
  const membersList = document.getElementById('teamMembersList');
  const members = currentProject.members || [];
  membersList.innerHTML = '';

  members.forEach((m) => {
    const isThisOwner = currentProject.owner && (currentProject.owner._id === m._id || currentProject.owner === m._id);
    const item = document.createElement('div');
    item.className = 'team-member-item';
    item.innerHTML = `
      <div class="member-info">
        <div class="member-avatar-mini">${getInitials(m.name)}</div>
        <div class="member-details-text">
          <strong>${escapeHtml(m.name)} ${isThisOwner ? '<span style="color: var(--badge-owner-text); font-size:0.75rem;">(Owner)</span>' : ''}</strong>
          <span>@${escapeHtml(m.username)} • ${escapeHtml(m.email)}</span>
        </div>
      </div>
      <div>
        ${
          isOwner && !isThisOwner
            ? `<button class="btn btn-danger btn-sm" onclick="removeMemberFromKanban('${m._id}', '${escapeHtml(m.username)}')">Remove</button>`
            : ''
        }
      </div>
    `;
    membersList.appendChild(item);
  });

  // Owner invite form visibility
  const inviteSection = document.getElementById('teamAddMemberSection');
  if (inviteSection) {
    inviteSection.style.display = isOwner ? 'block' : 'none';
  }
}

function setupTeamInviteForm() {
  const form = document.getElementById('teamAddMemberForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert('teamAddMemberAlert');

    const input = document.getElementById('teamMemberIdentifier');
    const identifier = input.value.trim();

    if (!identifier) return;

    try {
      const res = await authFetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ identifier })
      });

      if (!res) return;
      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert('teamAddMemberAlert', data.error || 'Failed to add member.');
        return;
      }

      currentProject = data.project;
      input.value = '';
      showAlert('teamAddMemberAlert', data.message || 'Member added!', 'success');
      populateMemberOptions();
      renderTeamModal();
    } catch (err) {
      showAlert('teamAddMemberAlert', 'Connection error.');
    }
  });
}

async function removeMemberFromKanban(userId, username) {
  if (!confirm(`Are you sure you want to remove @${username} from this project?`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    });

    if (!res) return;
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to remove member.');
      return;
    }

    currentProject = data.project;
    populateMemberOptions();
    renderTeamModal();
  } catch (err) {
    alert('Connection error.');
  }
}

// Setup common modal closing behavior
function setupModals() {
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
