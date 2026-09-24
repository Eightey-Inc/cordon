// CLoops service worker: (1) opt-in, per-window close protection via one guardian tab that the
// user arms with a click; (2) quiet local session snapshots as a backup.
// Nothing here runs at startup, and no tab is ever created without a user request.
import { getSettings } from '../shared/storage.js';
import { buildSnapshot, addSnapshot } from '../shared/snapshot.js';
import { GUARDIAN_PATH } from '../shared/constants.js';

let timer;
let queue = Promise.resolve();
const schedule = () => { clearTimeout(timer); timer = setTimeout(() => (queue = queue.then(save, save)), 1500); };

async function save() {
  try {
    const s = await getSettings();
    if (!s.autoSave) return;
    const snap = buildSnapshot(await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }));
    if (!snap) return;
    const { history = [] } = await chrome.storage.local.get('history');
    await chrome.storage.local.set({ history: addSnapshot(history, snap, s.maxSnapshots) });
  } catch (e) {
    console.warn('CLoops: snapshot failed:', e.message); // no URLs logged
  }
}

chrome.tabs.onCreated.addListener(schedule);
chrome.tabs.onMoved.addListener(schedule);
chrome.tabs.onAttached.addListener(schedule);
chrome.tabs.onDetached.addListener(schedule);
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.status === 'complete' || 'pinned' in info) schedule(); });
chrome.tabs.onRemoved.addListener((id, info) => {
  forget(id);
  if (info.isWindowClosing) clearTimeout(timer); // don't overwrite the snapshot with a half-closed browser
  else schedule();
});

// One-time cleanup of tabs left behind by the old guardian design (pre-1.0.1).
chrome.runtime.onInstalled.addListener(async (d) => {
  if (d.reason !== 'update') return;
  try {
    const old = await chrome.tabs.query({ url: chrome.runtime.getURL('src/guardian/*') });
    if (old.length) await chrome.tabs.remove(old.map((t) => t.id));
  } catch { /* nothing to clean */ }
});

// ---- Close protection (guardian) ----
const GUARDIAN_URL = chrome.runtime.getURL(GUARDIAN_PATH);
const ss = chrome.storage.session; // cleared on browser restart: restored guardians are never trusted
const guardians = async () =>
  (await chrome.runtime.getContexts({ contextTypes: ['TAB'] })).filter((c) => c.documentUrl?.startsWith(GUARDIAN_URL));

let gq = Promise.resolve(); // serializes create/remove so protect() is idempotent
const serial = (fn) => { const p = gq.then(fn); gq = p.catch(() => {}); return p; };

async function forget(tabId) {
  const { armed = {}, prevTabs = {} } = await ss.get(['armed', 'prevTabs']);
  delete armed[tabId]; delete prevTabs[tabId];
  await ss.set({ armed, prevTabs });
}

const protect = (windowId) => serial(async () => {
  const [prev] = await chrome.tabs.query({ active: true, windowId });
  const existing = (await guardians()).find((c) => c.windowId === windowId);
  const { nonces = {}, prevTabs = {} } = await ss.get(['nonces', 'prevTabs']);
  if (existing) { // reuse, never duplicate
    prevTabs[existing.tabId] = prev?.id;
    await ss.set({ prevTabs });
    await chrome.tabs.update(existing.tabId, { active: true });
    return;
  }
  const nonce = crypto.randomUUID();
  nonces[nonce] = { prevTabId: prev?.id };
  await ss.set({ nonces });
  await chrome.tabs.create({ windowId, url: `${GUARDIAN_URL}?n=${nonce}`, active: true, pinned: false });
});

const unprotect = (windowId) => serial(async () => {
  for (const c of (await guardians()).filter((g) => g.windowId === windowId)) {
    try { await chrome.tabs.sendMessage(c.tabId, { type: 'disarm' }); } catch { /* page gone */ }
    try { await chrome.tabs.remove(c.tabId); } catch { /* already closed */ }
  }
});

async function status(windowId) {
  const c = (await guardians()).find((g) => g.windowId === windowId);
  if (!c) return { state: 'off' };
  const { armed = {} } = await ss.get('armed');
  return { state: armed[c.tabId] ? 'armed' : 'needs-click' };
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  (async () => {
    const { nonces = {}, prevTabs = {}, armed = {} } = await ss.get(['nonces', 'prevTabs', 'armed']);
    if (msg.type === 'register') {
      const n = nonces[msg.nonce];
      if (!n) return respond({ ok: false });
      delete nonces[msg.nonce]; prevTabs[sender.tab.id] = n.prevTabId;
      await ss.set({ nonces, prevTabs });
      respond({ ok: true });
    } else if (msg.type === 'armed') {
      armed[sender.tab.id] = true; await ss.set({ armed });
      try { if (prevTabs[sender.tab.id]) await chrome.tabs.update(prevTabs[sender.tab.id], { active: true }); } catch { /* closed */ }
      respond({ ok: true });
    } else if (msg.type === 'protect') { await protect(msg.windowId); respond({ ok: true }); }
    else if (msg.type === 'unprotect') { await unprotect(msg.windowId); respond({ ok: true }); }
    else if (msg.type === 'status') respond(await status(msg.windowId));
    else respond(null);
  })().catch((e) => respond({ error: e.message }));
  return true;
});
