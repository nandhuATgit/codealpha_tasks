const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const auth = require('../middleware/auth');

// All project routes require authentication
router.use(auth);

// @route   POST /api/projects
// @desc    Create a new project (creator becomes owner and first member)
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required.'
      });
    }

    const trimmedName = name.trim();
    const trimmedDesc = description ? description.trim() : '';

    const newProject = new Project({
      name: trimmedName,
      description: trimmedDesc,
      owner: req.user.id,
      members: [req.user.id] // Creator is automatically added as a member
    });

    await newProject.save();

    const populatedProject = await Project.findById(newProject._id)
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    return res.status(201).json({
      success: true,
      message: 'Project created successfully!',
      project: populatedProject
    });
  } catch (error) {
    console.error('Create Project Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages.join('. ') });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to create project.'
    });
  }
});

// @route   GET /api/projects
// @desc    Get all projects where the current user is owner or member
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Find projects where the user is either the owner or included in the members array
    const projects = await Project.find({
      $or: [{ owner: userId }, { members: userId }]
    })
      .sort({ updatedAt: -1 })
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error('Fetch Projects Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch projects.'
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get a single project by ID (must be member or owner)
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id)
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Check membership authorization
    const userId = req.user.id;
    const isOwner = project.owner._id.toString() === userId;
    const isMember = project.members.some(member => member._id.toString() === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You must be an owner or member to view this project.'
      });
    }

    return res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Get Project Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve project details.'
    });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project details (owner only)
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Authorization: Only owner can update project
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the project owner can update project settings.'
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Project name cannot be empty.'
        });
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description.trim();
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully!',
      project: updatedProject
    });
  } catch (error) {
    console.error('Update Project Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages.join('. ') });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to update project.'
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project (owner only)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Authorization: Only owner can delete project
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the project owner can delete this project.'
      });
    }

    await Project.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Project Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete project.'
    });
  }
});

// @route   POST /api/projects/:id/members
// @desc    Add member to project by username or email (owner only)
// @access  Private
router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { identifier, email, username } = req.body;
    const memberIdentifier = identifier || email || username;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format.'
      });
    }

    if (!memberIdentifier || !memberIdentifier.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a username or email address to add as a member.'
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Authorization: Only owner can add members
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the project owner can add team members.'
      });
    }

    // Find the user to add
    const cleanIdentifier = memberIdentifier.trim().toLowerCase();
    const userToAdd = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }]
    }).select('-password');

    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: `User "${memberIdentifier.trim()}" not found. Make sure they have registered an account.`
      });
    }

    // Prevent duplicate members
    const isAlreadyMember = project.members.some(
      memberId => memberId.toString() === userToAdd._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        error: `User "${userToAdd.username}" is already a member of this project.`
      });
    }

    // Add member and save
    project.members.push(userToAdd._id);
    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    return res.status(200).json({
      success: true,
      message: `User ${userToAdd.username} added successfully!`,
      project: updatedProject
    });
  } catch (error) {
    console.error('Add Member Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add team member.'
    });
  }
});

// @route   DELETE /api/projects/:id/members/:userId
// @desc    Remove member from project (owner only)
// @access  Private
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID or user ID format.'
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found.'
      });
    }

    // Authorization: Only owner can remove members
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only the project owner can remove members.'
      });
    }

    // Cannot remove the project owner
    if (project.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove the project owner from the project.'
      });
    }

    // Check if the user is currently a member
    const isMember = project.members.some(
      memberId => memberId.toString() === userId
    );

    if (!isMember) {
      return res.status(400).json({
        success: false,
        error: 'User is not a member of this project.'
      });
    }

    // Remove member
    project.members = project.members.filter(
      memberId => memberId.toString() !== userId
    );

    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name username email')
      .populate('members', 'name username email');

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully.',
      project: updatedProject
    });
  } catch (error) {
    console.error('Remove Member Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove team member.'
    });
  }
});

module.exports = router;
