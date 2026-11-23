import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

it('isolates published rosters and only allows trusted writes and access to reservations', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-omp', firestore: { host: '127.0.0.1', port: 9085, rules: readFileSync('firestore.rules', 'utf8') },
  });
  const scope = 'event-planning-rules';
  const eventPath = 'events/event-planning-rules';
  const groupPath = `congregations/${scope}/serviceGroups/one`;
  const dayPath = `congregations/${scope}/eventShiftDays/2099-01-01`;
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, `congregations/${scope}`), {
          isActive: true, active: true, enabled: true, status: 'active',
          disabled: false, deactivated: false, accessDisabled: false,
        }),
        setDoc(doc(db, 'users/event-planning-admin'), { role: 'admin', isActive: true, congregationId: scope }),
        setDoc(doc(db, 'users/event-planning-member'), { role: 'user', isActive: true, congregationId: scope }),
        setDoc(doc(db, 'users/event-planning-foreign'), { role: 'admin', isActive: true, congregationId: 'other' }),
        setDoc(doc(db, eventPath), { congregationId: scope }),
        setDoc(doc(db, groupPath), { name: 'Grupo 1' }),
        setDoc(doc(db, dayPath), { reservations: [] }),
      ]);
    });
    const member = env.authenticatedContext('event-planning-member').firestore();
    const admin = env.authenticatedContext('event-planning-admin').firestore();
    const foreign = env.authenticatedContext('event-planning-foreign').firestore();
    await assertSucceeds(getDoc(doc(member, eventPath)));
    await assertSucceeds(getDoc(doc(member, groupPath)));
    await assertFails(getDoc(doc(foreign, eventPath)));
    await assertFails(getDoc(doc(foreign, groupPath)));
    await assertFails(getDoc(doc(admin, dayPath)));
    await assertFails(setDoc(doc(admin, groupPath), { name: 'Cambio' }));
    await assertFails(deleteDoc(doc(admin, eventPath)));
  } finally {
    await env.cleanup();
  }
}, 30_000);
