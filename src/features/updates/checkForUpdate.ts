import { region } from '../../region';
import { compareVersions, getCurrentAppVersion } from '../../utils/version';

// The app is distributed as a sideloaded APK attached to GitHub Releases
// (see .github/workflows/eas-build.yml), so "is there a newer version" is a
// question for the GitHub API rather than a store. The repo is public, so
// this needs no token — 60 requests/hour/IP, which useUpdateCheck's
// throttle keeps well clear of.
const REPO = region.identity.releaseRepo;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
// Stable link that always resolves to the newest full release's APK —
// safe to print anywhere without knowing the version.
export const LATEST_APK_URL = `https://github.com/${REPO}/releases/latest/download/inspectplus.apk`;

const APK_ASSET = 'inspectplus.apk';
const TIMEOUT_MS = 5_000;

export interface AvailableUpdate {
  version: string;
  url: string;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface Release {
  tag_name?: string;
  assets?: ReleaseAsset[];
}

// Release tags are `v<version>`; anything else (or a pre-release suffix,
// which `latest` never returns anyway) is not a version this can compare.
const versionFromTag = (tag: unknown): string | null => {
  if (typeof tag !== 'string') return null;
  const match = /^v?(\d+(?:\.\d+)*)$/.exec(tag);
  return match ? match[1] : null;
};

// Resolves to the newer release, or null — for "no newer release" and for
// every failure alike. The check is a convenience for an inspector who is
// often offline in the field, so nothing here is allowed to surface as an
// error. `fetchFn` is injectable for tests; production passes nothing.
export async function checkForUpdate(fetchFn: typeof fetch = fetch): Promise<AvailableUpdate | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchFn(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const release = (await response.json()) as Release;
    const version = versionFromTag(release?.tag_name);
    if (!version || compareVersions(version, getCurrentAppVersion()) <= 0) return null;
    const apk = release.assets?.find(a => a?.name === APK_ASSET && typeof a.browser_download_url === 'string');
    return { version, url: apk?.browser_download_url ?? LATEST_APK_URL };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
