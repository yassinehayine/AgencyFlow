/**
 * Slice 6 end-to-end verification: the role dashboards and the client portal.
 *
 * Runs against the live API, real MongoDB and the real Cloudinary account.
 * Builds its own fixtures — two client organisations, two Project Managers and
 * two Team Members — so it is repeatable and does not depend on whatever
 * happens to be in the database. The slice-4 script's first run produced five
 * false failures for exactly that reason.
 *
 *   npm run build --workspace @agencyflow/api
 *   node apps/api/dist/main.js &
 *   npm run verify:slice6 --workspace @agencyflow/api
 *
 * Every date below is computed FROM TODAY rather than hard-coded, because the
 * whole point of BR-20 is that the answer depends on when you ask. A fixture
 * pinned to a literal date would pass this week and quietly stop testing
 * anything next month.
 */
const BASE = 'http://localhost:3000/api/v1';
const PASSWORD = 'motdepasse123';

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

  return { status: response.status, body: await response.json().catch(() => null) };
}

const login = async (email, password = PASSWORD) =>
  (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;

/** A calendar day offset from today, as the `yyyy-MM-dd` the browser sends. */
function day(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

async function uploadPdf(token, path) {
  const boundary = '----agencyflow' + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="maquette.pdf"\r\n` +
      'Content-Type: application/pdf\r\n\r\n',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.concat([head, PDF, tail]),
  });

  return { status: response.status, body: await response.json() };
}

const titles = (list) => list.items.map((item) => item.title);
const names = (list) => list.items.map((item) => item.name);
const boardTitles = (dashboard) =>
  dashboard.tasksByStatus.flatMap((group) => group.tasks.map((task) => task.title));

(async () => {
  const admin = await login('admin@agencyflow.ma', 'ChangeMe-Local-2026');
  const run = Date.now();

  const createUser = async (role, label, extra = {}) =>
    (
      await call('POST', '/users', {
        token: admin,
        body: {
          name: label,
          username: `${label.toLowerCase().replace(/[^a-z]/g, '')}.${run}`,
          email: `${label.toLowerCase().replace(/[^a-z]/g, '')}.${run}@agencyflow.ma`,
          password: PASSWORD,
          role,
          ...extra,
        },
      })
    ).body;

  // --- Fixtures ------------------------------------------------------------
  // Two of everything, because every rule in this slice is about what one
  // person can see that another cannot. A single-tenant fixture would pass
  // even with the scope filters deleted.
  const orgA = (await call('POST', '/clients', { token: admin, body: { name: `Org A ${run}` } }))
    .body;
  const orgB = (await call('POST', '/clients', { token: admin, body: { name: `Org B ${run}` } }))
    .body;

  const pmA = await createUser('PROJECT_MANAGER', 'ChefA');
  const pmB = await createUser('PROJECT_MANAGER', 'ChefB');
  const member = await createUser('TEAM_MEMBER', 'MembreUn', { skill: 'BACKEND' });
  const otherMember = await createUser('TEAM_MEMBER', 'MembreDeux', { skill: 'FRONTEND' });

  const contactA = (
    await call('POST', `/clients/${orgA.id}/contacts`, {
      token: admin,
      body: {
        name: 'Contact A',
        username: `contacta.${run}`,
        email: `contacta.${run}@orga.ma`,
        password: PASSWORD,
      },
    })
  ).body;

  const contactB = (
    await call('POST', `/clients/${orgB.id}/contacts`, {
      token: admin,
      body: {
        name: 'Contact B',
        username: `contactb.${run}`,
        email: `contactb.${run}@orgb.ma`,
        password: PASSWORD,
      },
    })
  ).body;

  const makeProject = async (name, clientId, managerId) =>
    (
      await call('POST', '/projects', {
        token: admin,
        body: {
          name,
          clientId,
          projectManagerId: managerId,
          startDate: day(-30),
          endDate: day(120),
        },
      })
    ).body;

  const projectA = await makeProject(`Projet A ${run}`, orgA.id, pmA.id);
  const projectB = await makeProject(`Projet B ${run}`, orgB.id, pmB.id);

  for (const project of [projectA, projectB]) {
    for (const user of [member, otherMember]) {
      await call('POST', `/projects/${project.id}/team`, {
        token: admin,
        body: { userId: user.id },
      });
    }
    await call('POST', `/projects/${project.id}/milestones`, {
      token: admin,
      body: { name: 'Jalon a venir', order: 0, dueDate: day(20) },
    });
    await call('POST', `/projects/${project.id}/milestones`, {
      token: admin,
      body: { name: 'Jalon passe', order: 1, dueDate: day(-20) },
    });
  }

  const milestoneOf = async (project) =>
    (await call('GET', `/projects/${project.id}`, { token: admin })).body.milestones[0].id;

  const milestoneA = await milestoneOf(projectA);
  const milestoneB = await milestoneOf(projectB);

  const makeTask = async (project, milestoneId, title, assigneeId, dueDate) =>
    (
      await call('POST', `/projects/${project.id}/tasks`, {
        token: admin,
        body: { title, milestoneId, assigneeId, ...(dueDate ? { dueDate } : {}) },
      })
    ).body;

  // The five deadline positions that matter, all assigned to one member.
  const overdue = await makeTask(projectA, milestoneA, `EN-RETARD-${run}`, member.id, day(-2));
  const dueToday = await makeTask(projectA, milestoneA, `AUJOURDHUI-${run}`, member.id, day(0));
  const dueSoon = await makeTask(projectA, milestoneA, `BIENTOT-${run}`, member.id, day(3));
  const dueLater = await makeTask(projectA, milestoneA, `PLUS-TARD-${run}`, member.id, day(30));
  const undated = await makeTask(projectA, milestoneA, `SANS-DATE-${run}`, member.id);

  // Work belonging to someone else, and work in another PM's project.
  const someoneElses = await makeTask(
    projectA,
    milestoneA,
    `PAS-A-MOI-${run}`,
    otherMember.id,
    day(-5),
  );
  const otherProjectTask = await makeTask(
    projectB,
    milestoneB,
    `AUTRE-PROJET-${run}`,
    member.id,
    day(-5),
  );

  const pmAToken = await login(pmA.email);
  const memberToken = await login(member.email);
  const clientAToken = await login(contactA.email);
  const clientBToken = await login(contactB.email);

  console.log(`\nfixtures built for run ${run}\n`);

  // --- One endpoint, four shapes ------------------------------------------
  console.log('[FR-068 - FR-071] one endpoint, four shapes');
  check(
    (await call('GET', '/dashboard', { token: admin })).body.role === 'ADMINISTRATOR',
    'administrator gets the agency dashboard',
  );
  check(
    (await call('GET', '/dashboard', { token: pmAToken })).body.role === 'PROJECT_MANAGER',
    'project manager gets their own',
  );
  check(
    (await call('GET', '/dashboard', { token: memberToken })).body.role === 'TEAM_MEMBER',
    'team member gets their board',
  );
  check(
    (await call('GET', '/dashboard', { token: clientAToken })).body.role === 'CLIENT_CONTACT',
    'client contact gets the portal dashboard',
  );
  check((await call('GET', '/dashboard')).status === 401, 'unauthenticated is refused');

  // --- FR-072 / BR-20 ------------------------------------------------------
  console.log('\n[FR-072 / BR-20] deadlines computed on read, never stored');
  let memberDash = (await call('GET', '/dashboard', { token: memberToken })).body;
  const late = titles(memberDash.alerts.overdue);
  const soon = titles(memberDash.alerts.dueSoon);

  check(late.includes(overdue.title), 'a task due 2 days ago is overdue');
  check(
    !late.includes(dueToday.title),
    'a task due TODAY is NOT overdue - it is due by the end of the day',
  );
  check(soon.includes(dueToday.title), 'a task due today is due soon');
  check(soon.includes(dueSoon.title), 'a task due in 3 days is due soon');
  check(
    !soon.includes(dueLater.title) && !late.includes(dueLater.title),
    'a task due in 30 days is in neither list',
  );
  check(
    !soon.includes(undated.title) && !late.includes(undated.title),
    'a task with NO due date is in neither list',
  );

  // US-058: nothing was stored, so nothing can go stale.
  await call('POST', `/tasks/${overdue.id}/start`, { token: memberToken });
  await call('POST', `/tasks/${overdue.id}/submit-review`, { token: memberToken });
  await call('POST', `/tasks/${overdue.id}/done`, { token: pmAToken });

  memberDash = (await call('GET', '/dashboard', { token: memberToken })).body;
  check(
    !titles(memberDash.alerts.overdue).includes(overdue.title),
    'completing a task clears its alert on the next read, with no job to run',
  );

  // --- FR-070 / BR-26 ------------------------------------------------------
  console.log('\n[FR-070 / BR-26] a Team Member sees their own work');
  check(boardTitles(memberDash).includes(dueSoon.title), 'their own open task is on the board');
  check(
    !boardTitles(memberDash).includes(someoneElses.title),
    "another member's task is absent, in the same project",
  );
  check(
    !titles(memberDash.alerts.overdue).includes(someoneElses.title),
    'and absent from their alerts, though it IS overdue for its assignee',
  );
  check(
    memberDash.tasksByStatus.map((group) => group.status).join(',') ===
      'TODO,IN_PROGRESS,IN_REVIEW,BLOCKED',
    'all four columns are present and in board order, empty ones included',
  );
  check(memberDash.completedTaskCount >= 1, 'completed work is counted, not listed');

  // --- FR-069 / BR-25 ------------------------------------------------------
  console.log('\n[FR-069 / BR-25] a Project Manager sees the projects they own');
  await call('POST', `/tasks/${dueSoon.id}/start`, { token: memberToken });
  await call('POST', `/tasks/${dueSoon.id}/submit-review`, { token: memberToken });
  await call('POST', `/tasks/${dueLater.id}/block`, {
    token: memberToken,
    body: { reason: 'En attente des acces DNS' },
  });

  const pmDash = (await call('GET', '/dashboard', { token: pmAToken })).body;

  check(names(pmDash.myProjects).includes(projectA.name), 'their own project is listed');
  check(
    !names(pmDash.myProjects).includes(projectB.name),
    "another manager's project is not (BR-25)",
  );
  check(
    titles(pmDash.awaitingMyReview).includes(dueSoon.title),
    'a task in review is the primary call to action (BR-04)',
  );
  check(
    !titles(pmDash.awaitingMyReview).includes(otherProjectTask.title),
    "and nothing from another manager's project appears anywhere",
  );
  check(
    !titles(pmDash.alerts.overdue).includes(otherProjectTask.title),
    'including in their deadline alerts',
  );

  const blockedRow = pmDash.blockedTasks.items.find((task) => task.title === dueLater.title);
  check(Boolean(blockedRow), 'a blocked task is listed separately');
  check(
    blockedRow && blockedRow.blockedReason === 'En attente des acces DNS',
    'with the reason BR-22 made mandatory, which is what US-056 displays',
  );
  check(
    pmDash.myProjects.items.every((project) => project.openTaskCount !== undefined),
    'an internal role receives the open-task count',
  );

  // --- FR-068 --------------------------------------------------------------
  console.log('\n[FR-068] the Administrator sees the whole agency');
  const adminDash = (await call('GET', '/dashboard', { token: admin })).body;

  check(
    Object.keys(adminDash.projectCountsByStatus).sort().join(',') ===
      'CANCELLED,COMPLETED,IN_PROGRESS,ON_HOLD,PLANNED',
    'every project status is reported, including the zeroes',
  );
  check(
    titles(adminDash.overdueTasks).includes(someoneElses.title),
    'overdue work is visible agency-wide, whoever it belongs to',
  );
  check(
    adminDash.overdueTasks.items.every((task) => task.projectName),
    'each overdue task is listed WITH its project (US-055)',
  );
  const workload = adminDash.teamWorkload.find((entry) => entry.name === 'MembreDeux');
  check(Boolean(workload), 'the workload panel names people rather than ids');
  check(workload && workload.overdueTaskCount >= 1, 'and counts overdue work per person');
  check(
    adminDash.teamWorkload.every((entry) => entry.overdueTaskCount <= entry.openTaskCount),
    'an undated task is never counted as overdue',
  );

  // --- FR-071 / BR-10 / BR-28 ---------------------------------------------
  console.log('\n[FR-071 / BR-10 / BR-28] the client portal');
  const portalA = (await call('GET', '/dashboard', { token: clientAToken })).body;
  const portalB = (await call('GET', '/dashboard', { token: clientBToken })).body;

  check(names(portalA.projects).includes(projectA.name), 'a client sees their own project');
  check(
    !names(portalA.projects).includes(projectB.name),
    "another organisation's project is absent (BR-10)",
  );
  check(
    names(portalB.projects).includes(projectB.name) &&
      !names(portalB.projects).includes(projectA.name),
    'and the isolation holds in the other direction',
  );

  const serialised = JSON.stringify(portalA);
  check(
    !serialised.includes('tasksByStatus') &&
      !serialised.includes('teamWorkload') &&
      !serialised.includes('alerts'),
    'the client payload carries no task data at all (BR-28)',
  );
  check(!serialised.includes(String(member.name)), 'and names no member of the agency team');
  check(!serialised.includes('storageKey'), 'and no storage key (ADR-0003 S-2)');
  check(
    portalA.projects.items.every((project) => project.openTaskCount === undefined),
    'the open-task count is OMITTED for a client, not zeroed',
  );
  check(
    portalA.projects.items.every((project) => typeof project.progress === 'number'),
    'yet progress IS computed - a client sees no tasks and must see progress',
  );

  const upcoming = names(portalA.upcomingMilestones);
  check(upcoming.includes('Jalon a venir'), 'a milestone still ahead is listed');
  check(!upcoming.includes('Jalon passe'), 'one whose date has passed is not');
  check(
    portalA.upcomingMilestones.items.every((milestone) => milestone.projectName),
    'each carries its project, since the list spans projects',
  );

  // --- The approval loop reaches the portal --------------------------------
  console.log('\n[FR-071] the approval loop surfaces on the dashboard');
  const deliverable = (
    await call('POST', `/projects/${projectA.id}/deliverables`, {
      token: pmAToken,
      body: { name: `Maquette-${run}` },
    })
  ).body;

  check(
    !names(
      (await call('GET', '/dashboard', { token: clientAToken })).body.awaitingMyApproval,
    ).includes(deliverable.name),
    'a DRAFT does not appear as awaiting the client',
  );

  const uploaded = await uploadPdf(pmAToken, `/deliverables/${deliverable.id}/files`);
  check(uploaded.status === 201 || uploaded.status === 200, 'a file is attached (FR-046)');
  await call('POST', `/deliverables/${deliverable.id}/submit`, { token: pmAToken });

  const afterSubmit = (await call('GET', '/dashboard', { token: clientAToken })).body;
  check(
    names(afterSubmit.awaitingMyApproval).includes(deliverable.name),
    'once submitted it is waiting on the client (US-059)',
  );
  check(
    names((await call('GET', '/dashboard', { token: clientBToken })).body.awaitingMyApproval).every(
      (name) => name !== deliverable.name,
    ),
    "and invisible to another organisation's contact",
  );
  check(
    names(
      (await call('GET', '/dashboard', { token: pmAToken })).body.awaitingClientResponse,
    ).includes(deliverable.name),
    'the agency sees the same deliverable as awaiting the client',
  );

  await call('POST', `/deliverables/${deliverable.id}/approve`, { token: clientAToken });
  const afterApproval = (await call('GET', '/dashboard', { token: clientAToken })).body;

  check(
    !names(afterApproval.awaitingMyApproval).includes(deliverable.name),
    'approving clears it from the pending list',
  );
  check(
    names(afterApproval.recentlyApproved).includes(deliverable.name),
    'and files it under recently approved - the acceptance record',
  );
  check(
    !JSON.stringify(afterApproval).includes('storageKey'),
    'still no storage key after approval',
  );

  // --- QA-4 ----------------------------------------------------------------
  console.log('\n[QA-4] capped lists report their true total');
  const capped = (await call('GET', '/dashboard', { token: admin })).body.overdueTasks;
  check(capped.items.length <= 10, 'the list is capped at 10');
  check(
    capped.total >= capped.items.length,
    `the total is the real count, not the page size (${capped.items.length} of ${capped.total})`,
  );

  console.log(
    failures === 0 ? '\n=== ALL CHECKS PASSED ===\n' : `\n=== ${failures} CHECK(S) FAILED ===\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
