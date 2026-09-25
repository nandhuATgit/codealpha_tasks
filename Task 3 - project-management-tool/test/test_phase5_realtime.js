const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { io: ClientIO } = require('socket.io-client');

const authRoutes = require('../routes/auth');
const projectRoutes = require('../routes/projects');
const taskRoutes = require('../routes/tasks');
const commentRoutes = require('../routes/comments');
const notificationRoutes = require('../routes/notifications');
const socketManager = require('../socket');

async function runPhase5Tests() {
  console.log('\n============================================================');
  console.log('--- STARTING PHASE 5: SOCKET.IO REAL-TIME & NOTIFICATIONS TESTS ---');
  console.log('============================================================\n');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.JWT_SECRET = 'test_phase5_jwt_secret_key_889900';
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);
  console.log('Connected to in-memory MongoDB.');

  const app = express();
  const server = http.createServer(app);

  socketManager.init(server);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/notifications', notificationRoutes);

  await new Promise((resolve) => server.listen(5199, resolve));
  const BASE_URL = 'http://localhost:5199';
  console.log(`Test server running on ${BASE_URL}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extra = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extra}`);
      failed++;
    }
  }

  // Helper to connect socket client
  function createClientSocket(token) {
    return ClientIO(BASE_URL, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
  }

  let aliceToken = '';
  let aliceId = '';
  let bobToken = '';
  let bobId = '';
  let charlieToken = '';
  let charlieId = '';

  let createdProjectId = '';
  let createdTaskId = '';
  let createdCommentId = '';

  try {
    // ------------------------------------------------------------
    // 1. SETUP USERS
    // ------------------------------------------------------------
    console.log('\n--- SETUP: REGISTER USERS ---');

    const regAlice = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Walker', username: 'alice', email: 'alice@test.com', password: 'password123' })
    });
    const dataAlice = await regAlice.json();
    aliceToken = dataAlice.token;
    aliceId = dataAlice.user.id;
    assert(regAlice.status === 201 && aliceToken, 'Register Alice');

    const regBob = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Dylan', username: 'bob', email: 'bob@test.com', password: 'password123' })
    });
    const dataBob = await regBob.json();
    bobToken = dataBob.token;
    bobId = dataBob.user.id;
    assert(regBob.status === 201 && bobToken, 'Register Bob');

    const regCharlie = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie Day', username: 'charlie', email: 'charlie@test.com', password: 'password123' })
    });
    const dataCharlie = await regCharlie.json();
    charlieToken = dataCharlie.token;
    charlieId = dataCharlie.user.id;
    assert(regCharlie.status === 201 && charlieToken, 'Register Charlie');

    // ------------------------------------------------------------
    // 2. SOCKET.IO AUTHENTICATION TESTS
    // ------------------------------------------------------------
    console.log('\n--- PART 1: SOCKET.IO AUTHENTICATION & SECURITY ---');

    // Test: Connect without token -> fails
    const unauthSocket = createClientSocket(null);
    const unauthErr = await new Promise((resolve) => {
      unauthSocket.on('connect_error', (err) => resolve(err.message));
      unauthSocket.on('connect', () => resolve('connected_unexpectedly'));
    });
    unauthSocket.disconnect();
    assert(unauthErr.includes('Authentication error'), 'Reject socket connection without token', `Got: ${unauthErr}`);

    // Test: Connect with invalid token -> fails
    const invalidSocket = createClientSocket('invalid_bogus_token_123');
    const invalidErr = await new Promise((resolve) => {
      invalidSocket.on('connect_error', (err) => resolve(err.message));
      invalidSocket.on('connect', () => resolve('connected_unexpectedly'));
    });
    invalidSocket.disconnect();
    assert(invalidErr.includes('Authentication error'), 'Reject socket connection with invalid token', `Got: ${invalidErr}`);

    // Test: Connect Alice with valid token -> connects
    const aliceSocket = createClientSocket(aliceToken);
    const aliceConnected = await new Promise((resolve) => {
      aliceSocket.on('connect', () => resolve(true));
      aliceSocket.on('connect_error', () => resolve(false));
    });
    assert(aliceConnected === true, 'Alice connects with valid JWT token');

    // Test: Connect Bob with valid token -> connects
    const bobSocket = createClientSocket(bobToken);
    const bobConnected = await new Promise((resolve) => {
      bobSocket.on('connect', () => resolve(true));
      bobSocket.on('connect_error', () => resolve(false));
    });
    assert(bobConnected === true, 'Bob connects with valid JWT token');

    // Test: Connect Charlie with valid token -> connects
    const charlieSocket = createClientSocket(charlieToken);
    const charlieConnected = await new Promise((resolve) => {
      charlieSocket.on('connect', () => resolve(true));
      charlieSocket.on('connect_error', () => resolve(false));
    });
    assert(charlieConnected === true, 'Charlie connects with valid JWT token');

    // ------------------------------------------------------------
    // 3. PROJECT-SPECIFIC ROOMS & ACCESS CONTROL
    // ------------------------------------------------------------
    console.log('\n--- PART 2: PROJECT-SPECIFIC ROOMS & MEMBERSHIP VERIFICATION ---');

    // Alice creates a project
    const projRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: 'Alpha Flight System', description: 'Real-time telemetry' })
    });
    const projData = await projRes.json();
    assert(projRes.status === 201 && projData.success, 'Alice creates project');
    createdProjectId = projData.project._id;

    // Charlie (not a member) attempts to join Alice's project room -> rejected!
    const charlieJoinResult = await new Promise((resolve) => {
      charlieSocket.emit('join:project', { projectId: createdProjectId }, (ack) => {
        resolve(ack);
      });
      setTimeout(() => resolve({ timeout: true }), 1500);
    });
    assert(
      charlieJoinResult && charlieJoinResult.success === false && charlieJoinResult.error.includes('Access denied'),
      'Charlie (non-member) forbidden from joining project room',
      JSON.stringify(charlieJoinResult)
    );

    // Alice (owner) joins her project room -> succeeds!
    const aliceJoinResult = await new Promise((resolve) => {
      aliceSocket.emit('join:project', { projectId: createdProjectId }, (ack) => {
        resolve(ack);
      });
      setTimeout(() => resolve({ timeout: true }), 1500);
    });
    assert(aliceJoinResult && aliceJoinResult.success === true, 'Alice (owner) joins project room successfully');

    // Alice adds Bob to project
    // Setup listener on Bob socket for project_added notification
    const bobNotifPromise = new Promise((resolve) => {
      bobSocket.once('notification:new', (notif) => resolve(notif));
    });

    const addMemberRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ identifier: 'bob' })
    });
    const addMemberData = await addMemberRes.json();
    assert(addMemberRes.status === 200 && addMemberData.success, 'Alice adds Bob to project');

    // Verify Bob received real-time notification about being added
    const bobNotif = await Promise.race([
      bobNotifPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for notification')), 2000))
    ]).catch((e) => e);

    assert(
      bobNotif && bobNotif.type === 'project_added' && bobNotif.message.includes('Alpha Flight System'),
      'Bob receives real-time notification: "You were added to project"',
      JSON.stringify(bobNotif)
    );

    // Bob (now a member) joins project room -> succeeds!
    const bobJoinResult = await new Promise((resolve) => {
      bobSocket.emit('join:project', { projectId: createdProjectId }, (ack) => {
        resolve(ack);
      });
      setTimeout(() => resolve({ timeout: true }), 1500);
    });
    assert(bobJoinResult && bobJoinResult.success === true, 'Bob (now member) joins project room successfully');

    // ------------------------------------------------------------
    // 4. REAL-TIME TASK EVENTS & ASSIGNMENT NOTIFICATIONS
    // ------------------------------------------------------------
    console.log('\n--- PART 3: REAL-TIME TASK EVENTS & NOTIFICATIONS ---');

    // Listeners for task creation on Bob's socket & Charlie's socket
    let bobReceivedTaskCreated = null;
    let charlieReceivedTaskCreated = null;

    bobSocket.once('task:created', (data) => {
      bobReceivedTaskCreated = data;
    });
    charlieSocket.once('task:created', (data) => {
      charlieReceivedTaskCreated = data;
    });

    // Bob also listens for task_assigned notification
    const bobAssignedNotifPromise = new Promise((resolve) => {
      bobSocket.once('notification:new', (notif) => resolve(notif));
    });

    // Alice creates a task assigned to Bob
    const createTaskRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        project: createdProjectId,
        title: 'Calibrate Navigation Gyroscope',
        description: 'Verify all 3 rotational axes',
        priority: 'high',
        assignedTo: bobId,
        status: 'todo'
      })
    });
    const createTaskData = await createTaskRes.json();
    assert(createTaskRes.status === 201 && createTaskData.success, 'Alice creates task assigned to Bob');
    createdTaskId = createTaskData.task._id;

    // Allow socket messages to propagate
    await new Promise((r) => setTimeout(r, 200));

    assert(
      bobReceivedTaskCreated && bobReceivedTaskCreated.task && bobReceivedTaskCreated.task._id === createdTaskId,
      'Bob receives real-time "task:created" event in project room'
    );
    assert(
      charlieReceivedTaskCreated === null,
      'Charlie (outside room) does NOT receive project task:created event'
    );

    const bobAssignedNotif = await Promise.race([
      bobAssignedNotifPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]).catch((e) => e);

    assert(
      bobAssignedNotif && bobAssignedNotif.type === 'task_assigned' && bobAssignedNotif.message.includes('Calibrate Navigation Gyroscope'),
      'Bob receives real-time notification: "You were assigned a task"',
      JSON.stringify(bobAssignedNotif)
    );

    // ------------------------------------------------------------
    // 5. REAL-TIME TASK STATUS UPDATE
    // ------------------------------------------------------------
    console.log('\n--- PART 4: REAL-TIME STATUS CHANGE & NOTIFICATIONS ---');

    // Bob listens for task:status_changed and status_changed notification
    const bobStatusEventPromise = new Promise((resolve) => {
      bobSocket.once('task:status_changed', (data) => resolve(data));
    });
    const bobStatusNotifPromise = new Promise((resolve) => {
      bobSocket.once('notification:new', (notif) => resolve(notif));
    });

    // Alice moves task status to 'in-progress'
    const statusUpdateRes = await fetch(`${BASE_URL}/api/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ status: 'in-progress' })
    });
    const statusUpdateData = await statusUpdateRes.json();
    assert(statusUpdateRes.status === 200 && statusUpdateData.task.status === 'in-progress', 'Alice updates task status to in-progress');

    const bobStatusEvent = await Promise.race([
      bobStatusEventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout status event')), 2000))
    ]).catch((e) => e);

    assert(
      bobStatusEvent && bobStatusEvent.status === 'in-progress' && bobStatusEvent.taskId === createdTaskId,
      'Bob receives real-time "task:status_changed" event in project room'
    );

    const bobStatusNotif = await Promise.race([
      bobStatusNotifPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout status notif')), 2000))
    ]).catch((e) => e);

    assert(
      bobStatusNotif && bobStatusNotif.type === 'task_status_changed' && bobStatusNotif.message.includes('in-progress'),
      'Bob receives real-time notification: "Your task status changed"',
      JSON.stringify(bobStatusNotif)
    );

    // ------------------------------------------------------------
    // 6. REAL-TIME COMMENTS & COMMENT NOTIFICATIONS
    // ------------------------------------------------------------
    console.log('\n--- PART 5: REAL-TIME COMMENTS & NOTIFICATIONS ---');

    // Alice listens for real-time comment:created and notification:new
    const aliceCommentEventPromise = new Promise((resolve) => {
      aliceSocket.once('comment:created', (data) => resolve(data));
    });
    const aliceCommentNotifPromise = new Promise((resolve) => {
      aliceSocket.once('notification:new', (notif) => resolve(notif));
    });

    // Bob posts a comment on the task
    const postCommentRes = await fetch(`${BASE_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ task: createdTaskId, text: 'Telemetry sensors aligned to zero deviation.' })
    });
    const postCommentData = await postCommentRes.json();
    assert(postCommentRes.status === 201 && postCommentData.success, 'Bob posts a comment on the task');
    createdCommentId = postCommentData.comment._id;

    const aliceCommentEvent = await Promise.race([
      aliceCommentEventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout comment event')), 2000))
    ]).catch((e) => e);

    assert(
      aliceCommentEvent && aliceCommentEvent.comment && aliceCommentEvent.comment._id === createdCommentId,
      'Alice receives real-time "comment:created" event in project room'
    );

    const aliceCommentNotif = await Promise.race([
      aliceCommentNotifPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout comment notif')), 2000))
    ]).catch((e) => e);

    assert(
      aliceCommentNotif && aliceCommentNotif.type === 'comment_added' && aliceCommentNotif.message.includes('commented on task'),
      'Alice receives real-time notification: "Someone commented on your task"',
      JSON.stringify(aliceCommentNotif)
    );

    // Bob edits his comment
    const aliceCommentUpdatedPromise = new Promise((resolve) => {
      aliceSocket.once('comment:updated', (data) => resolve(data));
    });

    const editCommentRes = await fetch(`${BASE_URL}/api/comments/${createdCommentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
      body: JSON.stringify({ text: 'Updated: Telemetry sensors calibrated with 99.9% precision.' })
    });
    const editCommentData = await editCommentRes.json();
    assert(editCommentRes.status === 200 && editCommentData.comment.text.includes('99.9%'), 'Bob edits his comment');

    const aliceCommentUpdated = await Promise.race([
      aliceCommentUpdatedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout edit comment')), 2000))
    ]).catch((e) => e);

    assert(
      aliceCommentUpdated && aliceCommentUpdated.comment && aliceCommentUpdated.comment.text.includes('99.9%'),
      'Alice receives real-time "comment:updated" event in project room'
    );

    // Bob deletes his comment
    const aliceCommentDeletedPromise = new Promise((resolve) => {
      aliceSocket.once('comment:deleted', (data) => resolve(data));
    });

    const deleteCommentRes = await fetch(`${BASE_URL}/api/comments/${createdCommentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const deleteCommentData = await deleteCommentRes.json();
    assert(deleteCommentRes.status === 200 && deleteCommentData.success, 'Bob deletes his comment');

    const aliceCommentDeleted = await Promise.race([
      aliceCommentDeletedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout delete comment')), 2000))
    ]).catch((e) => e);

    assert(
      aliceCommentDeleted && aliceCommentDeleted.commentId === createdCommentId,
      'Alice receives real-time "comment:deleted" event in project room'
    );

    // ------------------------------------------------------------
    // 7. REAL-TIME TASK DELETION
    // ------------------------------------------------------------
    console.log('\n--- PART 6: REAL-TIME TASK DELETION ---');

    const bobTaskDeletedPromise = new Promise((resolve) => {
      bobSocket.once('task:deleted', (data) => resolve(data));
    });

    const deleteTaskRes = await fetch(`${BASE_URL}/api/tasks/${createdTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const deleteTaskData = await deleteTaskRes.json();
    assert(deleteTaskRes.status === 200 && deleteTaskData.success, 'Alice deletes task');

    const bobTaskDeleted = await Promise.race([
      bobTaskDeletedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout delete task')), 2000))
    ]).catch((e) => e);

    assert(
      bobTaskDeleted && bobTaskDeleted.taskId === createdTaskId,
      'Bob receives real-time "task:deleted" event in project room'
    );

    // ------------------------------------------------------------
    // 8. NOTIFICATION API ENDPOINT TESTS
    // ------------------------------------------------------------
    console.log('\n--- PART 7: NOTIFICATION REST API & SECURITY ---');

    // Bob views his notifications
    const bobNotifsRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobNotifsData = await bobNotifsRes.json();
    assert(bobNotifsRes.status === 200 && bobNotifsData.success && bobNotifsData.count >= 2, 'Bob fetches his notifications list');

    // Bob gets unread count
    const bobCountRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobCountData = await bobCountRes.json();
    assert(bobCountRes.status === 200 && bobCountData.unreadCount >= 2, 'Bob gets unread notifications count');

    // Bob marks single notification as read
    const firstNotifId = bobNotifsData.notifications[0]._id;
    const markReadRes = await fetch(`${BASE_URL}/api/notifications/${firstNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const markReadData = await markReadRes.json();
    assert(markReadRes.status === 200 && markReadData.notification.read === true, 'Bob marks single notification as read');

    // Security: Alice cannot mark Bob's notification as read
    const unauthorizedMarkRes = await fetch(`${BASE_URL}/api/notifications/${firstNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(unauthorizedMarkRes.status === 404, 'Alice cannot mark Bob notification as read (404/denied)');

    // Bob marks all notifications as read
    const markAllRes = await fetch(`${BASE_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const markAllData = await markAllRes.json();
    assert(markAllRes.status === 200 && markAllData.success, 'Bob marks all notifications as read');

    // Verify Bob's unread count is now 0
    const bobCountAfterRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobCountAfterData = await bobCountAfterRes.json();
    assert(bobCountAfterRes.status === 200 && bobCountAfterData.unreadCount === 0, 'Bob unread count is now 0');

    // ------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------
    aliceSocket.disconnect();
    bobSocket.disconnect();
    charlieSocket.disconnect();

  } catch (error) {
    console.error('Fatal Test Exception:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
    await new Promise((resolve) => server.close(resolve));

    console.log('\n========================================');
    console.log(`PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase5Tests();
