/**
 * Notices a newly deployed version while the app is open. The deployed
 * index.html names the build's entry script with a content hash, so a
 * different name there than in the running page means a new version is out.
 */

const ENTRY = /<script[^>]*type="module"[^>]*src="([^"]+)"/;
const RELOADED_FOR = 'vision-hero-reloaded-for';

export const newVersionAvailable = async (): Promise<boolean> => {
  if (!import.meta.env.PROD) return false;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' });
    if (!response.ok) return false;
    const latest = ENTRY.exec(await response.text())?.[1];
    const running = document.querySelector('script[type="module"][src]')?.getAttribute('src');
    if (!latest || !running || latest === running) return false;
    // One reload per new build, so a stale copy somewhere can never cause a reload loop.
    if (sessionStorage.getItem(RELOADED_FOR) === latest) return false;
    sessionStorage.setItem(RELOADED_FOR, latest);
    return true;
  } catch {
    // Offline, or storage blocked: keep running the current version.
    return false;
  }
};
