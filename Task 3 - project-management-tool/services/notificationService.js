const Notification = require('../models/Notification');
const { emitToUser } = require('../socket');

/**
 * Create a new notification and deliver it in real time via Socket.IO
 * @param {Object} param0
 * @param {string|mongoose.Types.ObjectId} param0.recipient - User receiving notification
 * @param {string|mongoose.Types.ObjectId} [param0.sender] - User triggering notification
 * @param {'task_assigned'|'task_status_changed'|'comment_added'|'project_added'|'general'} param0.type
 * @param {string} param0.message - Descriptive text
 * @param {string|mongoose.Types.ObjectId} [param0.project] - Related project
 * @param {string|mongoose.Types.ObjectId} [param0.task] - Related task
 * @returns {Promise<Notification|null>}
 */
async function createNotification({ recipient, sender = null, type, message, project = null, task = null }) {
  try {
    if (!recipient) return null;

    // Do not notify a user about their own actions
    if (sender && sender.toString() === recipient.toString()) {
      return null;
    }

    const notification = new Notification({
      recipient,
      sender,
      type,
      message,
      project,
      task,
      read: false,
      createdAt: new Date()
    });

    await notification.save();

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name username email')
      .populate('project', 'name')
      .populate('task', 'title');

    // Fetch updated unread count for the user
    const unreadCount = await Notification.countDocuments({
      recipient,
      read: false
    });

    // Real-time broadcast to user's private socket room
    emitToUser(recipient, 'notification:new', populated);
    emitToUser(recipient, 'notification:count', { unreadCount });

    return populated;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Get count of unread notifications for a user
 * @param {string|mongoose.Types.ObjectId} userId 
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
  return await Notification.countDocuments({
    recipient: userId,
    read: false
  });
}

module.exports = {
  createNotification,
  getUnreadCount
};
