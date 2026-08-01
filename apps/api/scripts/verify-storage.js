/**
 * Storage integration verification (ADR-0003, Slice 1 item 11).
 *
 * Exercises the real CloudinaryStorageService through the Nest DI container,
 * not the Cloudinary SDK directly - the point is to prove OUR adapter works,
 * including its resource_type: 'raw' handling.
 *
 * Not part of the CI test suite: it needs real credentials, which CI does not
 * have, and it makes live network calls. Run manually:
 *
 *   npm run build --workspace @agencyflow/api
 *   npm run verify:storage --workspace @agencyflow/api
 *
 * What this proves: the storage layer accepts every extension BR-15 permits
 * and returns bytes byte-identically. It does not validate document structure
 * - that is not the storage layer's concern.
 */
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { v2: cloudinary } = require('cloudinary');
const { AppConfigModule } = require('../dist/core/config/app-config.module');
const { StorageModule } = require('../dist/core/storage/storage.module');
const { STORAGE_SERVICE } = require('../dist/core/storage/storage.service.interface');

/**
 * Minimal context: configuration and storage only.
 *
 * Booting the full AppModule would drag in the Mongoose connection, so a
 * storage check would fail whenever the database happened to be down - a
 * diagnostic that reports the wrong subsystem is worse than no diagnostic.
 * The decorator is applied manually because this file is plain CommonJS.
 */
class StorageVerificationModule {}
Module({ imports: [AppConfigModule, StorageModule] })(StorageVerificationModule);

/** A small but structurally valid PDF. */
function makePdf() {
  return Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n' +
      'trailer<</Root 1 0 R>>\n' +
      '%%EOF\n',
    'utf8',
  );
}

/**
 * A valid empty ZIP archive (end-of-central-directory record only).
 * DOCX and XLSX are ZIP containers, so this is the correct magic number for
 * all three - which is exactly what BR-15's allow-list has to cope with.
 */
function makeZip() {
  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0, 'binary');
  return eocd;
}

const CASES = [
  { label: 'PDF', ext: 'pdf', mimeType: 'application/pdf', buffer: makePdf() },
  {
    label: 'DOCX',
    ext: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: makeZip(),
  },
  {
    label: 'XLSX',
    ext: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: makeZip(),
  },
  { label: 'ZIP', ext: 'zip', mimeType: 'application/zip', buffer: makeZip() },
];

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function report(ok, message) {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${message}`);
  return ok;
}

async function main() {
  const context = await NestFactory.createApplicationContext(StorageVerificationModule, {
    logger: ['error', 'warn'],
  });
  const storage = context.get(STORAGE_SERVICE);

  let failures = 0;
  const runId = Date.now();

  console.log('\n=== Cloudinary storage verification ===\n');

  console.log('[1] Connectivity');
  const reachable = await storage.ping();
  if (!report(reachable, 'ping() reports the account is reachable')) {
    failures += 1;
    console.log('\nCannot continue without connectivity.\n');
    await context.close();
    process.exit(1);
  }

  for (const testCase of CASES) {
    console.log(`\n[2] ${testCase.label} round trip (resource_type: raw)`);

    const path = `verification/${runId}`;
    const originalName = `verify-${runId}.${testCase.ext}`;
    let storageKey = null;

    try {
      // --- upload -------------------------------------------------------
      const uploaded = await storage.upload(testCase.buffer, {
        path,
        originalName,
        mimeType: testCase.mimeType,
      });
      storageKey = uploaded.storageKey;

      if (!report(Boolean(uploaded.storageKey), `upload returned a storageKey`)) failures += 1;
      if (
        !report(
          uploaded.sizeBytes === testCase.buffer.length,
          `metadata sizeBytes ${uploaded.sizeBytes} matches source ${testCase.buffer.length}`,
        )
      )
        failures += 1;
      if (
        !report(
          uploaded.mimeType === testCase.mimeType,
          `metadata mimeType is ${uploaded.mimeType}`,
        )
      )
        failures += 1;

      // --- download -----------------------------------------------------
      const downloaded = await collect(await storage.getStream(storageKey));
      if (
        !report(
          downloaded.equals(testCase.buffer),
          `download returned ${downloaded.length} bytes, byte-identical to source`,
        )
      )
        failures += 1;

      // --- delete -------------------------------------------------------
      //
      // Deletion is confirmed through the Admin API, not by re-fetching the
      // delivery URL. The download above warms Cloudinary's CDN, and an edge
      // cache keeps answering for a while after the origin asset is removed -
      // so a successful fetch proves nothing about whether the file still
      // exists. The Admin API reads origin state and is authoritative.
      //
      // This is the one place the script reaches past the storage port, which
      // is acceptable in a provider-specific diagnostic: verifying provider
      // state is precisely its job.
      await storage.delete(storageKey);
      const deletedKey = storageKey;
      storageKey = null;

      const stillExists = await cloudinary.api
        .resource(deletedKey, { resource_type: 'raw' })
        .then(() => true)
        .catch(() => false);

      if (!report(!stillExists, 'file no longer exists at origin (Admin API)')) failures += 1;
    } catch (error) {
      report(false, `unexpected error: ${error.message}`);
      failures += 1;
      if (storageKey) {
        await storage.delete(storageKey).catch(() => undefined);
      }
    }
  }

  console.log(
    `\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===\n`,
  );

  await context.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Verification aborted:', error);
  process.exit(1);
});
