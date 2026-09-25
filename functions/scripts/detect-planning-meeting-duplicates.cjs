#!/usr/bin/env node
/*
 * Report-only administrative utility. It never writes or deletes data.
 * Run from functions/: node scripts/detect-planning-meeting-duplicates.cjs
 */
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const keyFor = (timestamp) => {
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const kindFor = (data) =>
  data.meetingCategory === 'midweek' || data.type === 'midweek' ? 'midweek'
    : data.meetingCategory === 'weekend' || data.type === 'weekend' ? 'weekend' : null;

(async () => {
  const congregations = await db.collection('congregations').get();
  const report = [];
  for (const congregation of congregations.docs) {
    const meetings = await congregation.ref.collection('meetings').get();
    const groups = new Map();
    meetings.docs.forEach((meeting) => {
      const data = meeting.data();
      if (!data.meetingDate || typeof data.meetingDate.toDate !== 'function') return;
      const kind = kindFor(data);
      if (!kind) return;
      const dateKey = keyFor(data.meetingDate);
      const key = `${dateKey}::${kind}`;
      groups.set(key, [...(groups.get(key) || []), { id: meeting.id, dateKey, kind, status: data.status || null, publicationStatus: data.publicationStatus || null }]);
    });
    const duplicates = [...groups.values()].filter((entries) => entries.length > 1);
    if (!duplicates.length) continue;
    const schedules = await congregation.ref.collection('hospitalitySchedules').get();
    const itemRefs = [];
    for (const schedule of schedules.docs) {
      const items = await schedule.ref.collection('items').get();
      items.docs.forEach((item) => itemRefs.push({ scheduleId: schedule.id, itemId: item.id, ...item.data() }));
    }
    duplicates.forEach((meetingsForDay) => report.push({
      congregationId: congregation.id,
      dateKey: meetingsForDay[0].dateKey,
      meetingType: meetingsForDay[0].kind,
      meetings: meetingsForDay,
      scheduleItemReferences: itemRefs.filter((item) => meetingsForDay.some((meeting) => meeting.id === item.meetingId) || (item.meetingDate === meetingsForDay[0].dateKey && item.meetingType === meetingsForDay[0].kind)).map((item) => ({ scheduleId: item.scheduleId, itemId: item.itemId, meetingId: item.meetingId || null, roleKey: item.roleKey || null })),
    }));
  }
  console.log(JSON.stringify({ dryRun: true, duplicateGroups: report.length, report }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
