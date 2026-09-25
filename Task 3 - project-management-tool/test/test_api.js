const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const authRoutes = require('../routes/auth');
const projectRoutes = require('../routes/projects');
const taskRoutes = require('../routes/tasks');

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE API INTEGRATION TESTS ---');

  console.log('Initializing in-memory MongoDB server...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);
  console.log('Connected to in-memory MongoDB.');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);

  const server = app.listen(5099);
  const BASE_URL = 'http://localhost:5099';

  let aliceToken = '';
  let aliceId = '';
  let bobToken = '';
  let bobId = '';
  let charlieToken = '';
  let charlieId = '';
  let createdProjectId = '';

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

  try {
    console.log('\n--- PHASE 1: AUTHENTICATION TESTS ---');

    // Test 1: Register Alice
    const regRes1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Smith',
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      })
    });
    const regData1 = await regRes1.json();
    assert(regRes1.status === 201 && regData1.token && regData1.user.name === 'Alice Smith', 'Register Alice');
    aliceToken = regData1.token;
    aliceId = regData1.user.id;

    // Test 2: Register Bob
    const regRes2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Jones',
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123'
      })
    });
    const regData2 = await regRes2.json();
    assert(regRes2.status === 201 && regData2.token, 'Register Bob');
    bobToken = regData2.token;
    bobId = regData2.user.id;

    // Test 3: Register Charlie
    const regRes3 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie Brown',
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'password123'
      })
    });
    const regData3 = await regRes3.json();
    assert(regRes3.status === 201, 'Register Charlie');
    charlieToken = regData3.token;
    charlieId = regData3.user.id;

    // Test 4: Duplicate Email Check
    const dupEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Clone',
        username: 'alice_unique',
        email: 'alice@example.com',
        password: 'password123'
      })
    });
    assert(dupEmailRes.status === 400, 'Duplicate Email Rejected (400)');

    // Test 5: Duplicate Username Check
    const dupUserRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Alice',
        username: 'alice',
        email: 'another_alice@example.com',
        password: 'password123'
      })
    });
    assert(dupUserRes.status === 400, 'Duplicate Username Rejected (400)');

    // Test 6: Short Password Rejection (< 6 chars)
    const shortPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Short',
        username: 'shortuser',
        email: 'short@example.com',
        password: '123'
      })
    });
    assert(shortPassRes.status === 400, 'Short Password Rejected (400)');

    // Test 7: Login with Email & Valid Password
    const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: 'alice@example.com',
        password: 'password123'
      })
    });
    const loginData1 = await loginRes1.json();
    assert(loginRes1.status === 200 && loginData1.token, 'Login with Email');

    // Test 8: Login with Username & Valid Password
    const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: 'alice',
        password: 'password123'
      })
    });
    assert(loginRes2.status === 200, 'Login with Username');

    // Test 9: Login with Invalid Password
    const loginFail = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: 'alice',
        password: 'wrong_password'
      })
    });
    assert(loginFail.status === 400, 'Login with Incorrect Password Rejected (400)');

    // Test 10: Protected Route GET /api/auth/me (valid token)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user.username === 'alice' && !meData.user.password, 'Protected GET /api/auth/me (password omitted)');

    // Test 11: Protected Route without token
    const noTokenRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(noTokenRes.status === 401, 'Protected Route without Token Rejected (401)');

    // Test 12: Protected Route with invalid token
    const badTokenRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer this_is_a_fake_token' }
    });
    assert(badTokenRes.status === 401, 'Protected Route with Invalid Token Rejected (401)');

    console.log('\n--- PHASE 2: PROJECTS & COLLABORATION TESTS ---');

    // Test 13: Create Project without Name
    const createNoName = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ description: 'No name' })
    });
    assert(createNoName.status === 400, 'Create Project without Name Rejected (400)');

    // Test 14: Create Project as Alice
    const createRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        name: 'Alpha Launch Platform',
        description: 'First MVP release of collaborative tool.'
      })
    });
    const createData = await createRes.json();
    createdProjectId = createData.project._id;
    assert(
      createRes.status === 201 &&
      createData.project.owner._id === aliceId &&
      createData.project.members.some(m => m._id === aliceId),
      'Create Project (Creator is owner & automatically added as member)'
    );

    // Test 15: Get User Projects as Alice (should see 1 project)
    const aliceProjectsRes = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const aliceProjectsData = await aliceProjectsRes.json();
    assert(aliceProjectsRes.status === 200 && aliceProjectsData.count === 1, 'Alice Sees Her Created Project');

    // Test 16: Get User Projects as Bob (not yet a member, should see 0 projects)
    const bobProjectsRes1 = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobProjectsData1 = await bobProjectsRes1.json();
    assert(bobProjectsRes1.status === 200 && bobProjectsData1.count === 0, 'Bob Initially Sees 0 Projects');

    // Test 17: Bob tries to open Alice\'s project before being added
    const bobViewUnauthorized = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(bobViewUnauthorized.status === 403, 'Non-member Access to Single Project Denied (403)');

    // Test 18: Add Member - Non-existent user
    const addGhostRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ identifier: 'non_existent_user_999' })
    });
    assert(addGhostRes.status === 404, 'Add Non-Existent Member Returns 404');

    // Test 19: Alice adds Bob by username
    const addBobRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ identifier: 'bob' })
    });
    const addBobData = await addBobRes.json();
    assert(
      addBobRes.status === 200 &&
      addBobData.project.members.some(m => m.username === 'bob'),
      'Alice Adds Bob by Username (200)'
    );

    // Test 20: Duplicate Member Prevention
    const dupAddRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ identifier: 'bob@example.com' })
    });
    assert(dupAddRes.status === 400, 'Duplicate Member Addition Prevented (400)');

    // Test 21: Bob can now view the project
    const bobViewAuthorized = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobViewData = await bobViewAuthorized.json();
    assert(
      bobViewAuthorized.status === 200 && bobViewData.project.name === 'Alpha Launch Platform',
      'Bob Can Now View Single Project (200)'
    );

    // Test 22: Bob now sees the project in his project list
    const bobProjectsRes2 = await fetch(`${BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    const bobProjectsData2 = await bobProjectsRes2.json();
    assert(bobProjectsRes2.status === 200 && bobProjectsData2.count === 1, 'Bob Sees Project in His List');

    // Test 23: Bob (Member, not Owner) tries to add Charlie (Forbidden 403)
    const bobAddCharlie = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({ identifier: 'charlie' })
    });
    assert(bobAddCharlie.status === 403, 'Non-Owner Member Cannot Add Member (403)');

    // Test 24: Bob tries to update project details (Forbidden 403)
    const bobUpdate = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({ name: 'Bob Hacked The Name' })
    });
    assert(bobUpdate.status === 403, 'Non-Owner Member Cannot Update Project (403)');

    // Test 25: Alice (Owner) updates project details
    const aliceUpdate = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        name: 'Alpha Launch Platform v2',
        description: 'Updated project description by owner.'
      })
    });
    const aliceUpdateData = await aliceUpdate.json();
    assert(
      aliceUpdate.status === 200 && aliceUpdateData.project.name === 'Alpha Launch Platform v2',
      'Owner Can Update Project (200)'
    );

    // Test 26: Alice cannot remove herself (project owner)
    const removeOwnerRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members/${aliceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(removeOwnerRes.status === 400, 'Cannot Remove Project Owner (400)');

    // Test 27: Alice removes Bob from project members
    const removeBobRes = await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members/${bobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const removeBobData = await removeBobRes.json();
    assert(
      removeBobRes.status === 200 && !removeBobData.project.members.some(m => m._id === bobId),
      'Owner Removes Bob from Project (200)'
    );

    // -------------------------------------------------------------
    // PHASE 3: TASKS, ASSIGNMENTS & KANBAN TESTS
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: TASKS, ASSIGNMENTS & KANBAN TESTS ---');

    let task1Id = '';
    let task2Id = '';

    // Re-add Bob as member for task testing
    await fetch(`${BASE_URL}/api/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ identifier: 'bob' })
    });

    // Test 28: Non-member Charlie tries to create a task in Alice's project (403)
    const charlieCreateTask = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`
      },
      body: JSON.stringify({
        project: createdProjectId,
        title: 'Unauthorized Task'
      })
    });
    assert(charlieCreateTask.status === 403, 'Non-member cannot create task (403)');

    // Test 29: Create task without title (400)
    const noTitleTask = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        project: createdProjectId,
        title: ''
      })
    });
    assert(noTitleTask.status === 400, 'Create task without title rejected (400)');

    // Test 30: Assign task to non-member Charlie (400)
    const assignNonMember = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        project: createdProjectId,
        title: 'Task for Charlie',
        assignedTo: charlieId
      })
    });
    assert(assignNonMember.status === 400, 'Assign task to non-member rejected (400)');

    // Test 31: Alice creates task assigned to Bob (201)
    const taskRes1 = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        project: createdProjectId,
        title: 'Setup Database Schemas',
        description: 'Create Mongoose models for User, Project, and Task.',
        priority: 'high',
        status: 'todo',
        assignedTo: bobId,
        dueDate: '2026-10-15'
      })
    });
    const taskData1 = await taskRes1.json();
    assert(
      taskRes1.status === 201 &&
      taskData1.task.title === 'Setup Database Schemas' &&
      taskData1.task.assignedTo._id === bobId,
      'Project member Alice creates task assigned to Bob (201)'
    );
    task1Id = taskData1.task._id;

    // Test 32: Bob creates task assigned to Alice (201)
    const taskRes2 = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        project: createdProjectId,
        title: 'Design Kanban Drag-and-Drop UI',
        description: 'Implement responsive columns and HTML5 drag and drop.',
        priority: 'medium',
        status: 'in-progress',
        assignedTo: aliceId
      })
    });
    const taskData2 = await taskRes2.json();
    assert(
      taskRes2.status === 201 &&
      taskData2.task.createdBy._id === bobId,
      'Project member Bob creates task (201)'
    );
    task2Id = taskData2.task._id;

    // Test 33: Non-member Charlie cannot view project tasks (403)
    const charlieViewTasks = await fetch(`${BASE_URL}/api/tasks?project=${createdProjectId}`, {
      headers: { Authorization: `Bearer ${charlieToken}` }
    });
    assert(charlieViewTasks.status === 403, 'Non-member cannot view tasks (403)');

    // Test 34: Member Alice retrieves all project tasks (200, count = 2)
    const getTasksRes = await fetch(`${BASE_URL}/api/tasks?project=${createdProjectId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const getTasksData = await getTasksRes.json();
    assert(getTasksRes.status === 200 && getTasksData.count === 2, 'Project member views all tasks (200)');

    // Test 35: Filter tasks by priority (high)
    const filterPriorityRes = await fetch(`${BASE_URL}/api/tasks?project=${createdProjectId}&priority=high`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const filterPriorityData = await filterPriorityRes.json();
    assert(
      filterPriorityRes.status === 200 &&
      filterPriorityData.count === 1 &&
      filterPriorityData.tasks[0].priority === 'high',
      'Filter tasks by priority (high)'
    );

    // Test 36: Filter tasks by status (in-progress)
    const filterStatusRes = await fetch(`${BASE_URL}/api/tasks?project=${createdProjectId}&status=in-progress`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const filterStatusData = await filterStatusRes.json();
    assert(
      filterStatusRes.status === 200 &&
      filterStatusData.count === 1 &&
      filterStatusData.tasks[0].status === 'in-progress',
      'Filter tasks by status (in-progress)'
    );

    // Test 37: Filter tasks by assigned user (bob)
    const filterAssignedRes = await fetch(`${BASE_URL}/api/tasks?project=${createdProjectId}&assignedTo=bob`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const filterAssignedData = await filterAssignedRes.json();
    assert(
      filterAssignedRes.status === 200 &&
      filterAssignedData.count === 1 &&
      filterAssignedData.tasks[0].assignedTo.username === 'bob',
      'Filter tasks by assigned user'
    );

    // Test 38: Get single task by ID
    const singleTaskRes = await fetch(`${BASE_URL}/api/tasks/${task1Id}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const singleTaskData = await singleTaskRes.json();
    assert(singleTaskRes.status === 200 && singleTaskData.task._id === task1Id, 'Get single task by ID (200)');

    // Test 39: Update task details (title & description)
    const updateTaskRes = await fetch(`${BASE_URL}/api/tasks/${task1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        title: 'Setup Database Schemas (Completed Refactor)',
        description: 'Added indexing for high performance.'
      })
    });
    const updateTaskData = await updateTaskRes.json();
    assert(
      updateTaskRes.status === 200 &&
      updateTaskData.task.title === 'Setup Database Schemas (Completed Refactor)',
      'Update task details (200)'
    );

    // Test 40: Change task status (Kanban movement: todo -> in-progress -> done)
    const statusMoveRes = await fetch(`${BASE_URL}/api/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({ status: 'done' })
    });
    const statusMoveData = await statusMoveRes.json();
    assert(
      statusMoveRes.status === 200 &&
      statusMoveData.task.status === 'done',
      'Change task status via PATCH /status (200)'
    );

    // Test 41: Reassign task via PATCH /assign
    const assignRes = await fetch(`${BASE_URL}/api/tasks/${task1Id}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ assignedTo: aliceId })
    });
    const assignData = await assignRes.json();
    assert(
      assignRes.status === 200 &&
      assignData.task.assignedTo._id === aliceId,
      'Reassign task via PATCH /assign (200)'
    );

    // Test 42: Delete task - unauthorized user Charlie rejected (403)
    const charlieDeleteTask = await fetch(`${BASE_URL}/api/tasks/${task1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${charlieToken}` }
    });
    assert(charlieDeleteTask.status === 403, 'Non-member cannot delete task (403)');

    // Test 43: Task creator (Bob) deletes task 2 (200)
    const creatorDelete = await fetch(`${BASE_URL}/api/tasks/${task2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(creatorDelete.status === 200, 'Task creator deletes task (200)');

    // Test 44: Project owner (Alice) deletes task 1 (200)
    const ownerDeleteTask = await fetch(`${BASE_URL}/api/tasks/${task1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(ownerDeleteTask.status === 200, 'Project owner deletes task (200)');

    // -------------------------------------------------------------
    // CLEANUP & FINAL PROJECT DELETE
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP & PROJECT REMOVAL ---');

    // Test 45: Alice (Owner) deletes project (200)
    const aliceDelete = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(aliceDelete.status === 200, 'Owner Deletes Project (200)');

    // Test 31: Project is gone (404)
    const getDeleted = await fetch(`${BASE_URL}/api/projects/${createdProjectId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(getDeleted.status === 404, 'Deleted Project Returns 404');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runTests();
