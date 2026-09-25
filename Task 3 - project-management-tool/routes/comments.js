const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const { emitToProject } = require('../socket');
const { createNotification } = require('../services/notificationService');

// All comment routes require authentication
router.use(auth);

// Helper: check project membership
const isUserProjectMember = (project, userId) => {
  const userIdStr = userId.toString();
  const isOwner = project.owner && project.owner.toString() === userIdStr;
  const isMember =
    project.members &&
    project.members.some((m) => (m._id ? m._id.toString() === userIdStr : m.toString() === userIdStr));
  return isOwner || isMember;
};

// @route   POST /api/comments
// @desc    Add a comment to a task
// @access  Private (project members & owner only)
router.post('/', async (req, res) => {
  try {
    const { task: taskId, text } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required to post a comment.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Task ID format.'
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text cannot be empty.'
      });
    }

    const task = await Task.findById(taskId);
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
        error: 'Access denied. You must be a project member to comment on this task.'
      });
    }

    const newComment = new Comment({
      task: task._id,
      project: project._id,
      user: req.user.id,
      text: text.trim()
    });

    await newComment.save();

    const populatedComment = await Comment.findById(newComment._id)
      .populate('user', 'name username email');

    // Broadcast new comment to project room
    emitToProject(project._id, 'comment:created', { taskId: task._id, comment: populatedComment });

    // Send notifications to task assignee and task creator (excluding comment author)
    if (task.assignedTo && task.assignedTo.toString() !== req.user.id) {
      await createNotification({
        recipient: task.assignedTo,
        sender: req.user.id,
        type: 'comment_added',
        message: `${req.user.name || req.user.username} commented on your task "${task.title}".`,
        project: project._id,
        task: task._id
      });
    }

    if (task.createdBy.toString() !== req.user.id && (!task.assignedTo || task.assignedTo.toString() !== task.createdBy.toString())) {
      await createNotification({
        recipient: task.createdBy,
        sender: req.user.id,
        type: 'comment_added',
        message: `${req.user.name || req.user.username} commented on task "${task.title}".`,
        project: project._id,
        task: task._id
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully!',
      comment: populatedComment
    });
  } catch (error) {
    console.error('Create Comment Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, error: messages.join('. ') });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to post comment.'
    });
  }
});

// @route   GET /api/comments
// @desc    Get comments for a specific task
// @access  Private (project members & owner only)
router.get('/', async (req, res) => {
  try {
    const { task: taskId } = req.query;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID query parameter is required (?task=<id>).'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Task ID format.'
      });
    }

    const task = await Task.findById(taskId);
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

    const comments = await Comment.find({ task: taskId })
      .sort({ createdAt: 1 })
      .populate('user', 'name username email');

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments
    });
  } catch (error) {
    console.error('Get Comments Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comments.'
    });
  }
});

// @route   GET /api/comments/task/:taskId
// @desc    Convenience route to get all comments for a task
// @access  Private
router.get('/task/:taskId', (req, res) => {
  req.query.task = req.params.taskId;
  router.handle(req, res);
});

// @route   PUT /api/comments/:id
// @desc    Edit user's own comment
// @access  Private (author only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comment ID format.'
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text cannot be empty.'
      });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found.'
      });
    }

    // Authorization: User can only edit their own comment
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only edit your own comments.'
      });
    }

    comment.text = text.trim();
    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('user', 'name username email');

    // Broadcast updated comment to project room
    emitToProject(comment.project, 'comment:updated', { taskId: comment.task, comment: updatedComment });

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully!',
      comment: updatedComment
    });
  } catch (error) {
    console.error('Update Comment Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update comment.'
    });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete comment (author or project owner)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comment ID format.'
      });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found.'
      });
    }

    const project = await Project.findById(comment.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Associated project not found.'
      });
    }

    // Authorization: author of comment OR project owner
    const isAuthor = comment.user.toString() === req.user.id;
    const isProjectOwner = project.owner.toString() === req.user.id;

    if (!isAuthor && !isProjectOwner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the comment author or project owner can delete this comment.'
      });
    }

    const commentTaskId = comment.task;
    const commentProjectId = comment.project;
    await Comment.findByIdAndDelete(id);

    // Broadcast comment deletion to project room
    emitToProject(commentProjectId, 'comment:deleted', { taskId: commentTaskId, commentId: id });

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Comment Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete comment.'
    });
  }
});

module.exports = router;
