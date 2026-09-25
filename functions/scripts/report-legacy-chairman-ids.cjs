#!/usr/bin/env node
/*
 * Report-only compatibility audit for meetings that have a chairman name but
 * no canonical chairmanUserId. It never writes to Firestore.
 * Run from functions/: node scripts/report-legacy-chairman-ids.cjs
 */
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT });
const db = getFirestore();
const normalize = (value) => typeof value === 'string'
  ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  : '';

async function exactCandidates(congregationId, chairmanName) {
  const users = db.collection('users');
  const results = await Promise.all([
    users.where('congregationId', '==', congregationId).where('displayName', '==', chairmanName).limit(10).get(),
    ...(() => {
      const parts = chairmanName.trim().split(/\s+/);
      if (parts.length < 2) return [];
      const firstName = parts.shift();
      const lastName = parts.join(' ');
      return [users.where('congregationId', '==', congregationId)
        .where('firstName', '==', firstName).where('lastName', '==', lastName).limit(10).get()];
    })(),
  ]);
  const byId = new Map();
  for (const result of results) {
    for (const doc of result.docs) {
      const data = doc.data();
      const name = data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ');
      if (normalize(name) === normalize(chairmanName)) {
        byId.set(doc.id, { userId: doc.id, displayName: name, isActive: data.isActive !== false });
      }
    }
  }
  return [...byId.values()];
}

(async () => {
  const congregations = await db.collection('congregations').get();
  const report = [];
  for (const congregation of congregations.docs) {
    const meetings = await congregation.ref.collection('meetings').get();
    const legacy = meetings.docs
      .filter((meeting) => !meeting.get('chairmanUserId') && typeof meeting.get('chairman') === 'string' && meeting.get('chairman').trim())
      .map((meeting) => ({ meetingId: meeting.id, chairmanName: meeting.get('chairman').trim() }));
    for (const entry of legacy) {
      const candidates = await exactCandidates(congregation.id, entry.chairmanName);
      report.push({
        congregationId: congregation.id,
        ...entry,
        status: candidates.length === 1 ? 'unique_exact_match' : candidates.length > 1 ? 'ambiguous' : 'unresolved',
        proposedChairmanUserId: candidates.length === 1 ? candidates[0].userId : null,
        candidates,
      });
    }
  }
  const counts = report.reduce((summary, entry) => {
    summary[entry.status] = (summary[entry.status] || 0) + 1;
    return summary;
  }, {});
  console.log(JSON.stringify({ dryRun: true, writesPerformed: 0, meetingsNeedingReview: report.length, counts, report }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
