// Pure snapshot logic (no chrome.* calls) so it can be unit-tested in Node.
const restorable = (u) => /^https?:\/\//i.test(u || '');
const REPLACE_WINDOW_MS = 10 * 60 * 1000;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function buildSnapshot(windows, now = Date.now()) {
  const wins = windows
    .filter((w) => !w.incognito)
    .map((w) => ({
      tabs: (w.tabs || []).filter((t) => restorable(t.url))
        .map((t) => ({ url: t.url, title: (t.title || '').slice(0, 200), pinned: !!t.pinned })),
    }))
    .filter((w) => w.tabs.length);
  return wins.length ? { id: uid(), time: now, name: null, windows: wins } : null;
}

export const countTabs = (s) => s.windows.reduce((n, w) => n + w.tabs.length, 0);
const key = (s) => JSON.stringify(s.windows.map((w) => w.tabs.map((t) => [t.url, t.pinned])));

// Keeps a short history. A recent, unnamed snapshot is updated in place (keeping its id and
// any custom name); a sudden large drop in tab count is kept as a new entry so the fuller
// snapshot survives.
export function addSnapshot(history, snap, max) {
  if (!snap) return history;
  const head = history[0];
  if (head && key(head) === key(snap)) return history;
  const bigDrop = head && countTabs(snap) < countTabs(head) / 2;
  const fresh = head && snap.time - head.time < REPLACE_WINDOW_MS;
  const replace = head && fresh && !bigDrop;
  const entry = replace ? { ...snap, id: head.id, name: head.name } : snap;
  const rest = replace ? history.slice(1) : history;
  return [entry, ...rest].slice(0, Math.max(1, max));
}

export const renameSnapshot = (history, id, name) => {
  const trimmed = (name || '').trim().slice(0, 80);
  return history.map((s) => (s.id === id ? { ...s, name: trimmed || null } : s));
};
export const deleteSnapshot = (history, id) => history.filter((s) => s.id !== id);
