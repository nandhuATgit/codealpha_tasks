const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const auth = require('../middleware/auth');

// All task routes require authentication
router.use(auth);

// Helper: check if a user is an owner or member of a project
const isUserProjectMember = (project, userId) => {
  const userIdStr = userId.toString();
  const isOwner = project.owner && project.owner.toString() === userIdStr;
  const isMember =
    project.members &&
    project.members.some((m) => (m._id ? m._id.toString() === userIdStr : m.toString() === userIdStr));
  return isOwner || isMember;
};

// Helper: resolve user ID from ID, username, or email
const resolveUserId = async (identifier) => {
  if (!identifier) return null;
  const cleanId = String(identifier).trim();
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const user = await User.findById(cleanId);
    if (user) return user._id;
  }
  const user = await User.findOne({
    $or: [{ username: cleanId.toLowerCase() }, { email: cleanId.toLowerCase() }]
  });
  return user ? user._id : null;
};

// @route   POST /api/tasks
// @desc    Create a new task in a project
// @access  Private (project members & owner only)
router.post('/', async (req, res) => {
  try {
    const { title, description, project: projectId, assignedTo, priority, dueDate, status } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required to create a task.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Project ID format.'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Task title is required.'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Authorization: User must be owner or member of the project
    if (!isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You must be a member or owner of this project to create tasks.'
      });
    }

    // Validate assigned user if provided
    let assignedUserId = null;
    if (assignedTo) {
      assignedUserId = await resolveUserId(assignedTo);
      if (!assignedUserId) {
        return res.status(404).json({
          success: false,
          error: 'Assigned user does not exist.'
        });
      }

      if (!isUserProjectMember(project, assignedUserId)) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user must be a member or owner of this project.'
        });
      }
    }

    const newTask = new Task({
      title: title.trim(),
      description: description ? description.trim() : '',
      project: project._id,
      assignedTo: assignedUserId,
      createdBy: req.user.id,
      priority: priority && ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      status: status && ['todo', 'in-progress', 'done'].includes(status) ? status : 'todo',
      dueDate: dueDate ? new Date(dueDate) : null
    });

    await newTask.save();

    const populatedTask = await Task.findById(newTask._id)
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    return res.status(201).json({
      success: true,
      message: 'Task created successfully!',
      task: populatedTask
    });
  } catch (error) {
    console.error('Create Task Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, error: messages.join('. ') });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to create task.'
    });
  }
});

// @route   GET /api/tasks
// @desc    Get tasks for a project with optional filters (status, priority, assignedTo)
// @access  Private (project members & owner only)
router.get('/', async (req, res) => {
  try {
    const { project: projectId, status, priority, assignedTo } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a project ID query parameter (e.g. ?project=<id>).'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    if (!isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You must be a member or owner of this project to view tasks.'
      });
    }

    const query = { project: projectId };

    if (status && ['todo', 'in-progress', 'done'].includes(status)) {
      query.status = status;
    }

    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      query.priority = priority;
    }

    if (assignedTo) {
      const targetUserId = await resolveUserId(assignedTo);
      if (targetUserId) {
        query.assignedTo = targetUserId;
      } else {
        // If searching for unassigned tasks
        if (assignedTo === 'unassigned') {
          query.assignedTo = null;
        }
      }
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Get Tasks Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks.'
    });
  }
});

// @route   GET /api/tasks/project/:projectId
// @desc    Convenience route to get all tasks for a project
// @access  Private (project members & owner only)
router.get('/project/:projectId', async (req, res) => {
  req.query.project = req.params.projectId;
  // Forward to GET /
  router.handle(req, res);
});

// @route   GET /api/tasks/:id
// @desc    Get a single task by ID
// @access  Private (project members & owner only)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format.'
      });
    }

    const task = await Task.findById(id)
      .populate('project', 'name owner members')
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.'
      });
    }

    if (!isUserProjectMember(task.project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not belong to this project.'
      });
    }

    return res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Get Single Task Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve task.'
    });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task details (title, description, assignedTo, priority, dueDate, status)
// @access  Private (project members & owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assignedTo, priority, dueDate, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format.'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.'
      });
    }

    const project = await Project.findById(task.project);
    if (!project || !isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not belong to this project.'
      });
    }

    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Task title cannot be empty.'
        });
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description ? description.trim() : '';
    }

    if (priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'Priority must be low, medium, or high.'
        });
      }
      task.priority = priority;
    }

    if (status !== undefined) {
      if (!['todo', 'in-progress', 'done'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status must be todo, in-progress, or done.'
        });
      }
      task.status = status;
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === '' || assignedTo === 'unassigned') {
        task.assignedTo = null;
      } else {
        const assignedUserId = await resolveUserId(assignedTo);
        if (!assignedUserId) {
          return res.status(404).json({
            success: false,
            error: 'Assigned user does not exist.'
          });
        }
        if (!isUserProjectMember(project, assignedUserId)) {
          return res.status(400).json({
            success: false,
            error: 'Assigned user must be a member or owner of this project.'
          });
        }
        task.assignedTo = assignedUserId;
      }
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully!',
      task: updatedTask
    });
  } catch (error) {
    console.error('Update Task Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, error: messages.join('. ') });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to update task.'
    });
  }
});

// @route   PATCH /api/tasks/:id/status
// @desc    Change task status (Kanban movement)
// @access  Private (project members & owner only)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format.'
      });
    }

    if (!status || !['todo', 'in-progress', 'done'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (todo, in-progress, or done).'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.'
      });
    }

    const project = await Project.findById(task.project);
    if (!project || !isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not belong to this project.'
      });
    }

    task.status = status;
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    return res.status(200).json({
      success: true,
      message: `Task moved to ${status}!`,
      task: updatedTask
    });
  } catch (error) {
    console.error('Update Task Status Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task status.'
    });
  }
});

// @route   PATCH /api/tasks/:id/assign
// @desc    Assign or reassign task
// @access  Private (project members & owner only)
router.patch('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format.'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.'
      });
    }

    const project = await Project.findById(task.project);
    if (!project || !isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not belong to this project.'
      });
    }

    if (!assignedTo || assignedTo === 'unassigned') {
      task.assignedTo = null;
    } else {
      const assignedUserId = await resolveUserId(assignedTo);
      if (!assignedUserId) {
        return res.status(404).json({
          success: false,
          error: 'Assigned user does not exist.'
        });
      }
      if (!isUserProjectMember(project, assignedUserId)) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user must be a member or owner of this project.'
        });
      }
      task.assignedTo = assignedUserId;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username email');

    return res.status(200).json({
      success: true,
      message: 'Task assignment updated!',
      task: updatedTask
    });
  } catch (error) {
    console.error('Assign Task Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task assignment.'
    });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task (creator or project owner only)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format.'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found.'
      });
    }

    const project = await Project.findById(task.project);
    if (!project || !isUserProjectMember(project, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not belong to this project.'
      });
    }

    // Authorization: only task creator or project owner can delete task
    const isCreator = task.createdBy.toString() === req.user.id;
    const isProjectOwner = project.owner.toString() === req.user.id;

    if (!isCreator && !isProjectOwner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the task creator or project owner can delete this task.'
      });
    }

    await Task.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Task Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete task.'
    });
  }
});

module.exports = router;
