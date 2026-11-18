import {
  clearAllSessionCache,
  clearSessionCacheByPrefix,
  runSingleFlight,
} from '@/src/services/repositories/session-cache';

jest.mock('@/src/services/repositories/persistent-cache', () => ({
  clearPersistentCachedValue: jest.fn().mockResolvedValue(undefined),
  clearPersistentCacheByPrefix: jest.fn().mockResolvedValue(undefined),
}));

afterEach(clearAllSessionCache);

it('keeps a replacement request registered when an invalidated request finishes', async () => {
  const key = 'request:query:meetings/congregation';
  let finishOriginal!: (value: string) => void;
  const original = runSingleFlight(key, () => new Promise<string>((resolve) => {
    finishOriginal = resolve;
  }));
  clearSessionCacheByPrefix('query:meetings/');

  let finishReplacement!: (value: string) => void;
  const replacement = runSingleFlight(key, () => new Promise<string>((resolve) => {
    finishReplacement = resolve;
  }));

  expect(finishReplacement).toEqual(expect.any(Function));
  finishOriginal('old');
  await original;

  const unexpected = jest.fn().mockResolvedValue('duplicate');
  const joined = runSingleFlight(key, unexpected);
  expect(joined).toBe(replacement);
  finishReplacement('new');

  await expect(joined).resolves.toBe('new');
  expect(unexpected).not.toHaveBeenCalled();
});
