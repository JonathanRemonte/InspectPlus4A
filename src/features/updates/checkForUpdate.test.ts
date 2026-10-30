import { region } from '../../region';
import { checkForUpdate, LATEST_APK_URL, LATEST_RELEASE_API } from './checkForUpdate';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.4' }, nativeBuildVersion: '4' },
}));

const REPO = region.identity.releaseRepo;

type Release = { tag_name: string; html_url: string; assets: { name: string; browser_download_url: string }[] };

const release = (tag: string, assets: Release['assets'] = [{ name: 'inspectplus.apk', browser_download_url: `https://github.com/${REPO}/releases/download/${tag}/inspectplus.apk` }]): Release =>
  ({ tag_name: tag, html_url: `https://github.com/${REPO}/releases/tag/${tag}`, assets });

const okFetch = (body: unknown) =>
  jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

describe('checkForUpdate', () => {
  it('asks GitHub for the latest full release of this repo', async () => {
    const fetchFn = okFetch(release('v1.0.4'));
    await checkForUpdate(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(LATEST_RELEASE_API, expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github+json' }) }));
    expect(LATEST_RELEASE_API).toBe(`https://api.github.com/repos/${REPO}/releases/latest`);
  });

  it('reports a newer release with its APK download link', async () => {
    const update = await checkForUpdate(okFetch(release('v1.1.0')));
    expect(update).toEqual({ version: '1.1.0', url: `https://github.com/${REPO}/releases/download/v1.1.0/inspectplus.apk` });
  });

  it('compares numerically, so 1.0.10 is newer than the running 1.0.4', async () => {
    expect(await checkForUpdate(okFetch(release('v1.0.10')))).toMatchObject({ version: '1.0.10' });
  });

  it('reports nothing when the latest release is the running version or older', async () => {
    expect(await checkForUpdate(okFetch(release('v1.0.4')))).toBeNull();
    expect(await checkForUpdate(okFetch(release('v1.0.3')))).toBeNull();
  });

  it('falls back to the stable latest-APK link when the release carries no .apk asset', async () => {
    const update = await checkForUpdate(okFetch(release('v1.2.0', [{ name: 'notes.txt', browser_download_url: 'x' }])));
    expect(update).toEqual({ version: '1.2.0', url: LATEST_APK_URL });
    expect(LATEST_APK_URL).toBe(`https://github.com/${REPO}/releases/latest/download/inspectplus.apk`);
  });

  // Every failure mode is "no banner": the check is a convenience, and an
  // inspector offline in the field must never see an error for it.
  it('reports nothing on a network error, a non-2xx response, or a malformed body', async () => {
    const failing = jest.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;
    expect(await checkForUpdate(failing)).toBeNull();

    const notFound = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) })) as unknown as typeof fetch;
    expect(await checkForUpdate(notFound)).toBeNull();

    expect(await checkForUpdate(okFetch({ nonsense: true }))).toBeNull();
    expect(await checkForUpdate(okFetch(release('not-a-version')))).toBeNull();
  });

  it('gives up on a hung request instead of holding a promise open forever', async () => {
    jest.useFakeTimers();
    const hung = jest.fn((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const pending = checkForUpdate(hung);
    jest.advanceTimersByTime(5_000);
    await expect(pending).resolves.toBeNull();
    jest.useRealTimers();
  });
});
