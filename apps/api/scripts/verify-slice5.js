/**
 * Slice 5 end-to-end verification: the client approval loop.
 *
 * Runs against the live API, real MongoDB and the real Cloudinary account.
 * Builds its own fixtures, so it is repeatable and does not depend on whatever
 * happens to be in the database.
 *
 *   npm run build --workspace @agencyflow/api
 *   node apps/api/dist/main.js &
 *   npm run verify:slice5 --workspace @agencyflow/api
 */
const BASE = 'http://localhost:3000/api/v1';

let failures = 0;

function check(ok, label, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' - ' + detail : ''}`);
  if (!ok) failures += 1;
}

async function call(method, path, { token, body, raw } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: raw ? body : JSON.stringify(body) } : {}),
  });

  if (response.headers.get('content-type')?.includes('application/json')) {
    return { status: response.status, body: await response.json() };
  }

  return { status: response.status, body: await response.arrayBuffer(), response };
}

const login = async (email, password) =>
  (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;

/** A small but structurally valid PDF, so content sniffing has real bytes. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

function multipart(buffer, filename, contentType) {
  const boundary = '----agencyflow' + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return { body: Buffer.concat([head, buffer, tail]), boundary };
}

async function upload(token, path, buffer, filename, contentType) {
  const { body, boundary } = multipart(buffer, filename, contentType);

  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  return { status: response.status, body: await response.json() };
}

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
        name: `Verification slice 5 ${run}`,
        clientId: clientOrgId,
        projectManagerId: adminUser.id,
        startDate: '2026-09-01',
        endDate: '2026-12-01',
      },
    })
  ).body;

  const contact = (
    await call('POST', `/clients/${clientOrgId}/contacts`, {
      token: admin,
      body: {
        name: 'Contact Livrable',
        username: `livrable.${run}`,
        email: `livrable.${run}@client.ma`,
        password: 'motdepasse123',
      },
    })
  ).body;
  const client = await login(contact.email, 'motdepasse123');

  console.log(`\nfresh project ${project.name}\n`);

  // --- FR-045 / BR-15 -----------------------------------------------------
  console.log('[FR-045 / BR-15] authoring and the upload boundary');
  const created = await call('POST', `/projects/${project.id}/deliverables`, {
    token: admin,
    body: { name: 'Maquette page accueil', dueDate: '2026-10-15' },
  });
  check(created.status === 201 && created.body.status === 'DRAFT', 'created as DRAFT');
  const id = created.body.id;

  let r = await call('POST', `/deliverables/${id}/submit`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'SUBMISSION_REQUIRES_FILE',
    'submission with no file refused (FR-047)',
    `got ${r.status} ${r.body.code}`,
  );

  r = await upload(admin, `/deliverables/${id}/files`, PDF, 'virus.exe', 'application/pdf');
  check(
    r.status === 422 && r.body.code === 'FILE_REJECTED',
    'disallowed extension refused (BR-15)',
    `got ${r.status} ${r.body.code}`,
  );

  r = await upload(
    admin,
    `/deliverables/${id}/files`,
    Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    'facture.pdf',
    'application/pdf',
  );
  check(
    r.status === 422 && r.body.code === 'FILE_REJECTED',
    'EXECUTABLE renamed .pdf and declared as pdf REFUSED (NFR-24)',
    `got ${r.status} ${r.body.code}`,
  );

  r = await upload(admin, `/deliverables/${id}/files`, PDF, 'maquette v1.pdf', 'application/pdf');
  check(r.status === 201, 'valid PDF accepted', `got ${r.status}`);
  const fileId = r.body.versions[0].files[0]?.id;
  check(Boolean(fileId), 'file recorded on version 1');

  // --- ADR-0003 -----------------------------------------------------------
  console.log('\n[ADR-0003] the storage key never leaves the server');
  const detail = await call('GET', `/deliverables/${id}`, { token: admin });
  check(!JSON.stringify(detail.body).includes('storageKey'), 'storageKey absent from the response');

  // --- FR-056 -------------------------------------------------------------
  console.log('\n[FR-056] downloads are proxied and permission-checked');
  const download = await call('GET', `/deliverables/${id}/files/${fileId}`, { token: admin });
  check(download.status === 200, 'manager may download', `got ${download.status}`);
  check(
    Buffer.from(download.body).equals(PDF),
    'bytes are identical to what was uploaded',
    `${Buffer.from(download.body).length} vs ${PDF.length}`,
  );

  const anonymous = await fetch(`${BASE}/deliverables/${id}/files/${fileId}`);
  check(
    anonymous.status === 401,
    'an unauthenticated download is refused',
    `got ${anonymous.status}`,
  );

  // --- BR-05 / BR-31 ------------------------------------------------------
  console.log('\n[BR-05 / BR-31] who may submit, and how UNDER_REVIEW is reached');
  r = await call('POST', `/deliverables/${id}/submit`, { token: client });
  check(r.status === 403, 'a client may not submit (BR-05)', `got ${r.status}`);

  r = await call('POST', `/deliverables/${id}/submit`, { token: admin });
  check(r.status === 201 && r.body.status === 'SUBMITTED', 'manager submits');

  // BR-31: reading must not move the state.
  await call('GET', `/deliverables/${id}`, { token: client });
  r = await call('GET', `/deliverables/${id}`, { token: admin });
  check(
    r.body.status === 'SUBMITTED',
    'READING does not start the review (BR-31)',
    `status is ${r.body.status}`,
  );

  r = await call('POST', `/deliverables/${id}/start-review`, { token: admin });
  check(r.status === 403, 'agency staff may not start the review', `got ${r.status}`);

  r = await call('POST', `/deliverables/${id}/start-review`, { token: client });
  check(r.status === 201 && r.body.status === 'UNDER_REVIEW', 'the client starts it explicitly');

  // --- BR-06 --------------------------------------------------------------
  console.log('\n[BR-06] a change request appends a version, preserving the old one');
  r = await call('POST', `/deliverables/${id}/request-changes`, {
    token: client,
    body: { comment: 'Merci de revoir la palette de couleurs.' },
  });
  check(
    r.status === 201 && r.body.status === 'CHANGES_REQUESTED',
    'changes requested',
    `got ${r.status}`,
  );
  check(r.body.versions.length === 2, 'a second version was appended', `${r.body.versions.length}`);
  check(
    r.body.versions[0].outcome === 'CHANGES_REQUESTED' &&
      r.body.versions[0].files.length === 1 &&
      r.body.versions[0].decisionComment.includes('palette'),
    'version 1 keeps its file, its outcome and the comment',
  );
  check(
    r.body.versions[1].files.length === 0 && r.body.versions[1].outcome === 'PENDING',
    'version 2 starts empty and pending',
  );

  r = await call('POST', `/deliverables/${id}/submit`, { token: admin });
  check(
    r.status === 422 && r.body.code === 'SUBMISSION_REQUIRES_FILE',
    'v2 cannot be submitted empty either',
    `got ${r.status} ${r.body.code}`,
  );

  await upload(admin, `/deliverables/${id}/files`, PDF, 'maquette v2.pdf', 'application/pdf');
  r = await call('POST', `/deliverables/${id}/submit`, { token: admin });
  check(r.status === 201 && r.body.status === 'SUBMITTED', 'v2 submitted');
  check(
    r.body.versions[0].files.length === 1 && r.body.versions[1].files.length === 1,
    'v1 is still intact after the resubmission (BR-06)',
  );

  // --- FR-048 / BR-07 -----------------------------------------------------
  console.log('\n[FR-048 / BR-07] approval is the client’s, and it is final');
  r = await call('POST', `/deliverables/${id}/approve`, { token: admin });
  check(r.status === 403, 'the agency cannot approve its own work', `got ${r.status}`);

  r = await call('POST', `/deliverables/${id}/approve`, { token: client });
  check(r.status === 201 && r.body.status === 'APPROVED', 'the client approves');
  check(Boolean(r.body.approvedById && r.body.approvedAt), 'the acceptance record is written');

  r = await call('PATCH', `/deliverables/${id}`, { token: admin, body: { name: 'Autre nom' } });
  check(
    r.status === 422 && r.body.code === 'DELIVERABLE_ALREADY_APPROVED',
    'no edit after approval (BR-07)',
    `got ${r.status} ${r.body.code}`,
  );

  r = await upload(admin, `/deliverables/${id}/files`, PDF, 'apres.pdf', 'application/pdf');
  check(
    r.status === 422 && r.body.code === 'DELIVERABLE_ALREADY_APPROVED',
    'no new file after approval',
    `got ${r.status} ${r.body.code}`,
  );

  r = await call('POST', `/deliverables/${id}/request-changes`, {
    token: client,
    body: { comment: 'Finalement, non.' },
  });
  check(r.status === 422, 'no un-approval, even by the client who approved', `got ${r.status}`);

  // --- BR-10 --------------------------------------------------------------
  console.log('\n[BR-10] another organisation sees nothing');
  const otherOrg = (
    await call('POST', '/clients', { token: admin, body: { name: `Autre Org ${run}` } })
  ).body;
  const stranger = (
    await call('POST', `/clients/${otherOrg.id}/contacts`, {
      token: admin,
      body: {
        name: 'Contact Etranger',
        username: `etranger.${run}`,
        email: `etranger.${run}@autre.ma`,
        password: 'motdepasse123',
      },
    })
  ).body;
  const strangerToken = await login(stranger.email, 'motdepasse123');

  r = await call('GET', `/deliverables/${id}`, { token: strangerToken });
  check(r.status === 404, "another organisation's contact gets 404, not 403", `got ${r.status}`);

  const strangerDownload = await call('GET', `/deliverables/${id}/files/${fileId}`, {
    token: strangerToken,
  });
  check(
    strangerDownload.status === 404,
    'and cannot download the file with a direct URL (FR-056)',
    `got ${strangerDownload.status}`,
  );

  console.log(
    `\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error('\nVerification aborted:', error.message);
  process.exit(1);
});
