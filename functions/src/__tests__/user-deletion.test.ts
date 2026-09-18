import { classifyUserDeletionReferences } from '../users/user-deletion.js';

describe('user deletion preflight classification', () => {
  it('blocks active and future references while preserving historical ones', () => {
    const result = classifyUserDeletionReferences([
      { kind: 'meeting', id: 'future-meeting', active: true },
      { kind: 'assignment', id: 'past-assignment', active: false },
      { kind: 'cleaningGroup', id: 'active-cleaning', active: true },
    ]);
    expect(result.active).toEqual([
      { kind: 'meeting', id: 'future-meeting', active: true },
      { kind: 'cleaningGroup', id: 'active-cleaning', active: true },
    ]);
    expect(result.historical).toEqual([{ kind: 'assignment', id: 'past-assignment', active: false }]);
  });

  it('permits deletion when there are only historical references', () => {
    expect(classifyUserDeletionReferences([
      { kind: 'outgoingTalk', id: 'completed-talk', active: false },
    ]).active).toEqual([]);
  });
});
