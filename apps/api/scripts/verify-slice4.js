/**
 * Slice 4 end-to-end verification against the running API and real MongoDB.
 *
 * Builds its OWN fixtures. The first version asserted percentages against a
 * milestone that already held tasks from earlier manual testing and reported
 * failures that were arithmetic on the wrong denominator — a check that
 * depends on ambient state is not a check.
 */
const BASE = 'http://localhost:3000/api/v1';

let failures = 0;

function check(ok, label, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' - ' + detail : ''}`);
  if (!ok) failures += 1;
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return { status: response.status, body: payload };
}

const login = async (email, password) =>
  (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;

(async () => {
  const admin = await login('admin@agencyflow.ma', 'ChangeMe-Local-2026');
  const run = Date.now();

  const clientOrgId = (await call('GET', '/clients?pageSize=1', { token: admin })).body.items[0].id;
  const adminUser = (await call('GET', '/users?role=ADMINISTRATOR&isActive=true', { token: admin }))
    .body.items[0];

  const project = (
    await call('POST', '/projects', {
      token: admin,
      body: {
        name: `Verification slice 4 ${run}`,
        clientId: clientOrgId,
        projectManagerId: adminUser.id,
        startDate: '2026-09-01',
        endDate: '2026-12-01',
      },
    })
  ).body;

  const memberId = (
    await call('POST', '/users', {
      token: admin,
      body: {
        name: 'Membre Verification',
        username: `verif.${run}`,
        email: `verif.${run}@agencyflow.ma`,
        password: 'motdepasse123',
        role: 'TEAM_MEMBER',
        skill: 'BACKEND',
      },
    })
  ).body.id;

  await call('POST', `/projects/${project.id}/team`, { token: admin, body: { userId: memberId } });

  const milestone = (
    await call('POST', `/projects/${project.id}/milestones`, {
      token: admin,
      body: { name: 'Phase de verification', order: 0 },
    })
  ).body.milestones[0];

  const member = await login(`verif.${run}@agencyflow.ma`, 'motdepasse123');

  const newTask = async (title) =>
    (
      await call('POST', `/projects/${project.id}/tasks`, {
        token: admin,
        body: { title, milestoneId: milestone.id, assigneeId: memberId },
      })
    ).body;

  const milestoneView = async (token) => {
    const view = await call('GET', `/projects/${project.id}`, { token });
    return {
      view,
      milestone: view.body.milestones.find((m) => m.id === milestone.id),
    };
  };

  console.log(`\nfresh project ${project.name}\n`);

  // --- BR-04 --------------------------------------------------------------
  console.log('[BR-04] only a manager may complete a task');
  const first = await newTask('Maquette page accueil');

  let r = await call('POST', `/tasks/${first.id}/start`, { token: member });
  check(r.status === 201 && r.body.status === 'IN_PROGRESS', 'assignee may start their own task');

  r = await call('POST', `/tasks/${first.id}/submit-review`, { token: member });
  check(r.status === 201 && r.body.status === 'IN_REVIEW', 'assignee may submit for review');

  r = await call('POST', `/tasks/${first.id}/done`, { token: member });
  check(
    r.status === 403 && r.body.code === 'FORBIDDEN',
    'TEAM MEMBER REFUSED 403 on done, even from IN_REVIEW',
    `got ${r.status} ${r.body.code}`,
  );

  r = await call('POST', `/tasks/${first.id}/done`, { token: admin });
  check(r.status === 201 && r.body.status === 'DONE', 'manager may complete it');
  check(Boolean(r.body.completedById), 'completedById recorded (BR-04 audit trail)');

  r = await call('POST', `/tasks/${first.id}/start`, { token: admin });
  check(r.status === 422, 'DONE is terminal', `got ${r.status}`);

  // --- BR-26 --------------------------------------------------------------
  console.log('\n[BR-26] a team member may modify only their own tasks');
  const otherId = (
    await call('POST', '/users', {
      token: admin,
      body: {
        name: 'Autre Membre',
        username: `autre.${run}`,
        email: `autre.${run}@agencyflow.ma`,
        password: 'motdepasse123',
        role: 'TEAM_MEMBER',
        skill: 'QA',
      },
    })
  ).body.id;
  await call('POST', `/projects/${project.id}/team`, { token: admin, body: { userId: otherId } });
  const other = await login(`autre.${run}@agencyflow.ma`, 'motdepasse123');

  const second = await newTask('Integration maquette');
  r = await call('POST', `/tasks/${second.id}/start`, { token: other });
  check(r.status === 403, 'another team member is refused', `got ${r.status}`);

  r = await call('GET', `/tasks/${second.id}`, { token: other });
  check(r.status === 200, 'but they may still VIEW it (BR-26 allows viewing)', `got ${r.status}`);

  // --- BR-22 --------------------------------------------------------------
  console.log('\n[BR-22] a blocked task carries a reason');
  r = await call('POST', `/tasks/${second.id}/block`, { token: member, body: { reason: '   ' } });
  check(r.status === 400 || r.status === 422, 'whitespace-only reason refused', `got ${r.status}`);

  r = await call('POST', `/tasks/${second.id}/block`, {
    token: member,
    body: { reason: '  en attente du client  ' },
  });
  check(
    r.status === 201 && r.body.blockedReason === 'en attente du client',
    'reason stored trimmed',
    JSON.stringify(r.body.blockedReason),
  );

  r = await call('POST', `/tasks/${second.id}/unblock`, { token: member });
  check(
    r.status === 201 && r.body.status === 'TODO' && r.body.blockedReason === undefined,
    'unblock clears the reason',
  );

  // --- BR-08 / BR-12 ------------------------------------------------------
  console.log('\n[BR-08/BR-12] progress is computed; cancelled tasks leave it entirely');
  let m = (await milestoneView(admin)).milestone;
  check(
    m.progress === 50 && m.status === 'IN_PROGRESS',
    '1 done of 2 = 50% IN_PROGRESS',
    `${m.progress}% ${m.status}`,
  );

  r = await call('POST', `/tasks/${second.id}/cancel`, { token: admin });
  check(r.status === 201 && r.body.status === 'CANCELLED', 'manager may cancel');

  m = (await milestoneView(admin)).milestone;
  check(
    m.progress === 100 && m.status === 'COMPLETED',
    'cancelling the last open task COMPLETES the milestone (BR-12)',
    `${m.progress}% ${m.status}`,
  );

  // --- FR-033 vs BR-28 ----------------------------------------------------
  console.log('\n[FR-033 vs BR-28] a client sees progress, never tasks or the roster');
  const contact = (
    await call('POST', `/clients/${clientOrgId}/contacts`, {
      token: admin,
      body: {
        name: 'Contact Verification',
        username: `contact.${run}`,
        email: `contact.${run}@client.ma`,
        password: 'motdepasse123',
      },
    })
  ).body;
  const client = await login(contact.email, 'motdepasse123');

  const clientSide = await milestoneView(client);
  check(clientSide.view.status === 200, 'client may read their own project');
  check(
    clientSide.milestone && clientSide.milestone.progress === 100,
    'client sees computed progress (FR-033)',
    `${clientSide.milestone && clientSide.milestone.progress}%`,
  );
  check(clientSide.view.body.team === undefined, 'client sees no team roster (BR-28)');

  r = await call('GET', '/tasks', { token: client });
  check(r.status === 403, 'client refused the task list (BR-28)', `got ${r.status}`);

  // --- FR-034 -------------------------------------------------------------
  console.log('\n[FR-034] a milestone with open tasks cannot be deleted');
  const third = await newTask('Tache encore ouverte');

  r = await call('DELETE', `/projects/${project.id}/milestones/${milestone.id}`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'MILESTONE_HAS_OPEN_TASKS',
    'refused while a task is open',
    `got ${r.status} ${r.body.code}`,
  );

  // --- FR-024 / BR-32 -----------------------------------------------------
  console.log('\n[FR-024 / BR-32] outstanding work blocks removal and deactivation');
  r = await call('DELETE', `/projects/${project.id}/team/${memberId}`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'MEMBER_HAS_OPEN_TASKS',
    'team removal refused (FR-024)',
    `got ${r.status} ${r.body.code}`,
  );

  r = await call('POST', `/users/${memberId}/deactivate`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'USER_HAS_OPEN_TASKS',
    'deactivation refused (BR-32) - US-008 is enforceable at last',
    `got ${r.status} ${r.body.code}`,
  );
  check(
    Array.isArray(r.body.details) && r.body.details.length > 0,
    'the blocking tasks are LISTED, not merely counted',
    r.body.details && r.body.details[0] && r.body.details[0].message,
  );

  await call('POST', `/tasks/${third.id}/cancel`, { token: admin });
  r = await call('POST', `/users/${memberId}/deactivate`, { token: admin });
  check(
    r.status === 201 && r.body.isActive === false,
    'deactivation succeeds once nothing is outstanding',
    `got ${r.status}`,
  );

  // --- A-10 ---------------------------------------------------------------
  console.log('\n[A-10] the last active administrator is protected');
  r = await call('POST', `/users/${adminUser.id}/deactivate`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'LAST_ACTIVE_ADMINISTRATOR',
    'refused',
    `got ${r.status} ${r.body.code}`,
  );

  // --- ADR-0005 -----------------------------------------------------------
  console.log('\n[ADR-0005] deactivation bites on the very next request');
  r = await call('GET', '/tasks', { token: member });
  check(
    r.status === 401,
    "the deactivated member's still-valid token is refused",
    `got ${r.status}`,
  );

  console.log(
    `\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error('\nVerification aborted:', error.message);
  process.exit(1);
});
