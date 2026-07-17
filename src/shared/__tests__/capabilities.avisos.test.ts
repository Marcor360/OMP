import { readFileSync } from 'fs';
import { resolve } from 'path';

import { canManageEvents, CapabilityProfile } from '@/src/shared/capabilities';

type FixtureCase = {
  description: string;
  profile: CapabilityProfile;
  expected: boolean;
};

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../firestore-rules/fixtures/avisos.capability-cases.json'),
    'utf8'
  )
) as { cases: FixtureCase[] };

describe('shared capabilities: avisos/eventos contract fixture', () => {
  it.each(fixture.cases)('$description', ({ profile, expected }) => {
    expect(canManageEvents({ ...profile, isActive: true })).toBe(expected);
  });
});
