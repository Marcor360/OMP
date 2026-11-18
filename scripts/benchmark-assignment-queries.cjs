// Run only against a local Firestore emulator with project demo-omp.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const functionsRequire = createRequire(resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore, Timestamp } = functionsRequire('firebase-admin/firestore');

const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
assert.equal(process.env.GCLOUD_PROJECT, 'demo-omp');

const app = initializeApp({ projectId: 'demo-omp' });
const db = getFirestore(app);
const congregationId = `assignment-benchmark-${randomUUID()}`;
const congregation = db.collection('congregations').doc(congregationId);
const meetings = congregation.collection('meetings');
const day = 86_400_000;
const start = Timestamp.fromMillis(Date.UTC(2027, 0, 1));
const end = Timestamp.fromMillis(start.toMillis() + 30 * day);
const window = (query, field) => query.where(field, '>=', start).where(field, '<=', end);
const meetingCount = 24;
const assignmentsPerMeeting = 8;

const readPerMeeting = async () => {
  const parents = await window(meetings, 'startDate').get();
  const children = await Promise.all(
    parents.docs.map((doc) => window(doc.ref.collection('assignments'), 'dueDate').get())
  );
  return {
    paths: children.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref.path)).sort(),
    queries: parents.size + 1,
    documents: parents.size + children.reduce((sum, snapshot) => sum + snapshot.size, 0),
  };
};

const readByGroup = async () => {
  const [parents, children] = await Promise.all([
    window(meetings, 'startDate').get(),
    window(db.collectionGroup('assignments').where('congregationId', '==', congregationId), 'dueDate').get(),
  ]);
  const ids = new Set(parents.docs.map((doc) => doc.id));
  return {
    paths: children.docs.filter((doc) =>
      doc.ref.parent.parent?.parent.path === meetings.path && ids.has(doc.ref.parent.parent.id)
    ).map((doc) => doc.ref.path).sort(),
    queries: 2,
    documents: parents.size + children.size,
  };
};

async function main() {
  const writes = db.batch();
  for (let i = 0; i < meetingCount; i += 1) {
    const ref = meetings.doc(String(i));
    const date = Timestamp.fromMillis(start.toMillis() + i * day);
    writes.set(ref, { startDate: date });
    for (let j = 0; j < assignmentsPerMeeting; j += 1) {
      writes.set(ref.collection('assignments').doc(String(j)), {
        congregationId,
        dueDate: date,
      });
    }
  }

  try {
    await writes.commit();
    const baseline = await readPerMeeting();
    const candidate = await readByGroup();
    assert.equal(baseline.paths.length, meetingCount * assignmentsPerMeeting);
    assert.deepEqual(candidate.paths, baseline.paths);
    const stats = new Map([[readPerMeeting, []], [readByGroup, []]]);
    for (let i = 0; i < 12; i += 1) {
      const order = i % 2 === 0 ? [readPerMeeting, readByGroup] : [readByGroup, readPerMeeting];
      for (const read of order) {
        const began = performance.now();
        const result = await read();
        stats.get(read).push(performance.now() - began);
        assert.deepEqual(result.paths, baseline.paths);
      }
    }
    for (const [read, result] of [[readPerMeeting, baseline], [readByGroup, candidate]]) {
      const samples = stats.get(read).sort((a, b) => a - b);
      console.log(JSON.stringify({
        strategy: read.name,
        queries: result.queries,
        documentsReturned: result.documents,
        assignments: result.paths.length,
        p50ms: Math.round((samples[5] + samples[6]) / 2),
        p95ms: Math.round(samples[11]),
      }));
    }

    // Legacy rows without a denormalized congregation ID remain visible on their parent path.
    await meetings.doc('0').collection('assignments').doc('legacy').set({ dueDate: start });
    assert.equal((await readPerMeeting()).paths.length, baseline.paths.length + 1);
    assert.equal((await readByGroup()).paths.length, candidate.paths.length);
    console.log('Legacy compatibility: the collection group omits 1 assignment without congregationId.');
  } finally {
    await db.recursiveDelete(congregation);
    await deleteApp(app);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
