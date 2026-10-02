import { RetryableLoader } from './retryable-loader';

describe('RetryableLoader', () => {
  it('shares an in-progress load between callers', async () => {
    const load = vi.fn(async () => 'module');
    const loader = new RetryableLoader(load);

    const firstLoad = loader.get();
    const secondLoad = loader.get();

    expect(firstLoad).toBe(secondLoad);
    await expect(firstLoad).resolves.toBe('module');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('starts a new load after a failed attempt', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('module');

    const loader = new RetryableLoader(load);

    await expect(loader.get()).rejects.toThrow(
      'Network error',
    );
    await expect(loader.get()).resolves.toBe('module');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
