// Pure snapshot logic (no chrome.* calls) so it can be unit-tested in Node.
const restorable = (u) => /^https?:\/\//i.test(u || '');
const REPLACE_WINDOW_MS = 10 * 60 * 1000;

export function buildSnapshot(windows, now = Date.now()) {
  const wins = windows
    .filter((w) => !w.incognito)
    .map((w) => ({
      tabs: (w.tabs || []).filter((t) => restorable(t.url))
        .map((t) => ({ url: t.url, title: (t.title || '').slice(0, 200), pinned: !!t.pinned })),
    }))
    .filter((w) => w.tabs.length);
  return wins.length ? { time: now, windows: wins } : null;
}

export const countTabs = (s) => s.windows.reduce((n, w) => n + w.tabs.length, 0);
const key = (s) => JSON.stringify(s.windows.map((w) => w.tabs.map((t) => [t.url, t.pinned])));

// Keeps a short history. A recent snapshot is updated in place; a sudden large drop in
// tab count (possible partial state during shutdown/startup) is kept as a new entry so
// the fuller snapshot survives.
export function addSnapshot(history, snap, max) {
  if (!snap) return history;
  const head = history[0];
  if (head && key(head) === key(snap)) return history;
  const bigDrop = head && countTabs(snap) < countTabs(head) / 2;
  const fresh = head && snap.time - head.time < REPLACE_WINDOW_MS;
  const rest = head && fresh && !bigDrop ? history.slice(1) : history;
  return [snap, ...rest].slice(0, Math.max(1, max));
}
