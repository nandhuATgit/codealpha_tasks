const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { emitToUser } = require('../socket');
const { getUnreadCount } = require('../services/notificationService');

// All notification routes require authentication
router.use(auth);

// @route   GET /api/notifications
// @desc    Get notifications for logged-in user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30, read } = req.query;

    const query = { recipient: userId };
    if (read !== undefined) {
      query.read = read === 'true';
    }

    const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

    const [notifications, totalUnread] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(maxLimit)
        .populate('sender', 'name username email')
        .populate('project', 'name')
        .populate('task', 'title'),
      getUnreadCount(userId)
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: totalUnread,
      notifications
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications.'
    });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count for current user
// @access  Private
router.get('/unread-count', async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return res.status(200).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get Unread Count Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve unread count.'
    });
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Mark all notifications as read for current user
// @access  Private
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { recipient: userId, read: false },
      { $set: { read: true } }
    );

    // Real-time update for badge count
    emitToUser(userId, 'notification:count', { unreadCount: 0 });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read.'
    });
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID format.'
      });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or access denied.'
      });
    }

    notification.read = true;
    await notification.save();

    const unreadCount = await getUnreadCount(req.user.id);
    emitToUser(req.user.id, 'notification:count', { unreadCount });

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name username email')
      .populate('project', 'name')
      .populate('task', 'title');

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification: populated
    });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification status.'
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID format.'
      });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or access denied.'
      });
    }

    const unreadCount = await getUnreadCount(req.user.id);
    emitToUser(req.user.id, 'notification:count', { unreadCount });

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete notification.'
    });
  }
});

module.exports = router;
