import { runReversibleUserMutation } from '../users/user-mutation-coordinator.js';

const mutation = (overrides: Partial<Parameters<typeof runReversibleUserMutation>[0]> = {}) => {
  const auth = {
    getUser: jest.fn(async () => ({ displayName: 'Before', disabled: false })),
    updateUser: jest.fn(async () => undefined),
  };
  const applyFirestore = jest.fn(async () => undefined);
  return {
    auth,
    applyFirestore,
    input: {
      operationId: 'operation-1', uid: 'user-1', auth, authUpdates: { displayName: 'After', disabled: true }, applyFirestore,
      ...overrides,
    },
  };
};

describe('runReversibleUserMutation', () => {
  it('commits Auth then Firestore on success', async () => {
    const { auth, applyFirestore, input } = mutation();
    await runReversibleUserMutation(input);
    expect(auth.getUser).toHaveBeenCalledWith('user-1');
    expect(auth.updateUser).toHaveBeenCalledWith('user-1', { displayName: 'After', disabled: true });
    expect(applyFirestore).toHaveBeenCalledTimes(1);
  });

  it('restores Auth when Firestore fails', async () => {
    const { auth, input } = mutation({ applyFirestore: jest.fn(async () => { throw new Error('firestore failed'); }) });
    await expect(runReversibleUserMutation(input)).rejects.toThrow('firestore failed');
    expect(auth.updateUser).toHaveBeenLastCalledWith('user-1', { displayName: 'Before', disabled: false });
  });

  it('still surfaces the authoritative Firestore failure if compensation fails', async () => {
    const { auth, input } = mutation({ applyFirestore: jest.fn(async () => { throw new Error('firestore failed'); }) });
    auth.updateUser.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('rollback failed'));
    await expect(runReversibleUserMutation(input)).rejects.toThrow('firestore failed');
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it('does not touch Auth for an exclusively Firestore mutation', async () => {
    const { auth, applyFirestore, input } = mutation({ authUpdates: {} });
    await runReversibleUserMutation(input);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(applyFirestore).toHaveBeenCalledTimes(1);
  });
});
