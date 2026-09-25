const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Project = require('./models/Project');

let io = null;

/**
 * Initialize Socket.IO instance and register handlers
 * @param {import('http').Server} server 
 */
function init(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket Authentication Middleware
  // Verifies JWT token supplied in handshake auth or headers
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth && socket.handshake.auth.token;

      if (!token && socket.handshake.headers && socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server configuration error: JWT_SECRET missing'));
      }

      const decoded = jwt.verify(token, secret);
      socket.user = decoded; // { id, name, username, email }
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Socket Connection Handler
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRoom = `user:${userId}`;

    // Join authenticated user's private notification room
    socket.join(userRoom);

    // Join project room with strict membership verification
    socket.on('join:project', async (data, callback) => {
      try {
        const projectId = typeof data === 'string' ? data : (data && data.projectId);

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
          const errMsg = 'Invalid project ID format';
          if (typeof callback === 'function') callback({ success: false, error: errMsg });
          socket.emit('error:unauthorized', { message: errMsg });
          return;
        }

        const project = await Project.findById(projectId);
        if (!project) {
          const errMsg = 'Project not found';
          if (typeof callback === 'function') callback({ success: false, error: errMsg });
          socket.emit('error:unauthorized', { message: errMsg });
          return;
        }

        // Security check: Only owners or members may join project room
        const userIdStr = socket.user.id.toString();
        const isOwner = project.owner && project.owner.toString() === userIdStr;
        const isMember =
          project.members &&
          project.members.some((m) => (m._id ? m._id.toString() === userIdStr : m.toString() === userIdStr));

        if (!isOwner && !isMember) {
          const errMsg = 'Access denied. You are not a member of this project.';
          if (typeof callback === 'function') callback({ success: false, error: errMsg });
          socket.emit('error:unauthorized', { message: errMsg });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);

        if (typeof callback === 'function') {
          callback({ success: true, room: roomName, projectId });
        }
        socket.emit('joined:project', { projectId });
      } catch (err) {
        console.error('Socket join:project error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Internal server error joining project room' });
        }
      }
    });

    // Leave project room
    socket.on('leave:project', (data, callback) => {
      const projectId = typeof data === 'string' ? data : (data && data.projectId);
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    });

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });

  return io;
}

/**
 * Get current Socket.IO instance
 */
function getIO() {
  return io;
}

/**
 * Emit event to a specific user's private room
 * @param {string} userId 
 * @param {string} event 
 * @param {any} data 
 */
function emitToUser(userId, event, data) {
  if (io && userId) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
}

/**
 * Emit event to a specific project room
 * @param {string} projectId 
 * @param {string} event 
 * @param {any} data 
 */
function emitToProject(projectId, event, data) {
  if (io && projectId) {
    io.to(`project:${projectId.toString()}`).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToUser,
  emitToProject
};
