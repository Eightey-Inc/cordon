// Node tests against a MOCKED chrome API. They check our logic, not Chrome's behavior.
import assert from 'node:assert/strict';
import { buildSnapshot, addSnapshot, countTabs, renameSnapshot, deleteSnapshot, mergeHistory } from '../src/shared/snapshot.js';

let n = 0; const ok = (m) => console.log('ok', ++n, m);
const tab = (url, x = {}) => ({ url, title: 't', ...x });

// --- snapshot logic
const snap = buildSnapshot([
  { tabs: [tab('https://a.com'), tab('chrome://settings'), tab('chrome-extension://x/g.html'), tab('https://b.com', { pinned: true })] },
  { incognito: true, tabs: [tab('https://secret.com')] }], 1000);
assert.equal(countTabs(snap), 2); ok('snapshot filters non-http, extension pages, incognito');
let h = addSnapshot([], snap, 3);
assert.equal(addSnapshot(h, { ...snap, time: 2000 }, 3).length, 1); ok('dedupes identical snapshots');
h = addSnapshot(h, buildSnapshot([{ tabs: [tab('https://a.com'), tab('https://c.com'), tab('https://d.com')] }], 5000), 3);
h = addSnapshot(h, buildSnapshot([{ tabs: [tab('https://a.com')] }], 6000), 3);
assert.equal(h.length, 2); assert.equal(countTabs(h[1]), 3); ok('keeps fuller snapshot on big drop');

// --- rename / delete / id persistence
let r = addSnapshot([], buildSnapshot([{ tabs: [tab('https://a.com')] }], 1000), 30);
const id0 = r[0].id;
r = renameSnapshot(r, id0, '  Work stuff  ');
assert.equal(r[0].name, 'Work stuff'); ok('rename trims whitespace and stores custom name');
r = addSnapshot(r, buildSnapshot([{ tabs: [tab('https://a.com'), tab('https://b.com')] }], 1500), 30);
assert.equal(r[0].id, id0); assert.equal(r[0].name, 'Work stuff'); ok('custom name and id survive an in-place snapshot update');
r = renameSnapshot(r, id0, '   ');
assert.equal(r[0].name, null); ok('renaming to blank clears the custom name');
const before = r.length;
r = deleteSnapshot(r, id0);
assert.equal(r.length, before - 1); assert.ok(!r.find((x) => x.id === id0)); ok('delete removes only the targeted snapshot');
let cap = [];
for (let i = 0; i < 35; i++) cap = addSnapshot(cap, buildSnapshot([{ tabs: [tab(`https://x${i}.com`)] }], 100000 + i * 700000), 30);
assert.equal(cap.length, 30); ok('history is capped at 30 when maxSnapshots is 30');

// --- import / merge
const base = addSnapshot([], buildSnapshot([{ tabs: [tab('https://keep.com')] }], 1000), 30);
const importedGood = [{ id: 'ext-1', time: 2000, name: 'Imported', windows: [{ tabs: [{ url: 'https://imported.com', title: 'x', pinned: false }] }] }];
const importedBad = [{ id: 'bad', time: 3000, windows: 'nope' }, { time: 4000, windows: [{ tabs: [{ url: 'javascript:evil()' }] }] }];
const mergedRes = mergeHistory(base, [...importedGood, ...importedBad], 30);
assert.equal(mergedRes.added, 1); assert.equal(mergedRes.skipped, 2); ok('mergeHistory keeps valid entries, drops malformed ones');
assert.ok(mergedRes.history.find((s) => s.id === 'ext-1')); assert.ok(mergedRes.history.find((s) => s.id === base[0].id)); ok('mergeHistory keeps both existing and imported snapshots');
assert.equal(mergeHistory(base, importedGood, 1).history.length, 1); ok('mergeHistory respects the max cap');
const dirty = [{ id: 'empty-win', time: 5000, windows: [{ tabs: [] }] }, { id: 'long-title', time: 6000, windows: [{ tabs: [{ url: 'https://x.com', title: 'y'.repeat(500) }] }] }];
const cleanedRes = mergeHistory(base, dirty, 30);
assert.equal(cleanedRes.skipped, 1); assert.equal(cleanedRes.added, 1); ok('mergeHistory drops a snapshot whose only window has no tabs');
assert.equal(cleanedRes.history.find((s) => s.id === 'long-title').windows[0].tabs[0].title.length, 200); ok('mergeHistory caps an imported tab title at 200 chars, matching normal snapshots');

// --- mocked chrome
const L = {}; const ev = (k) => ({ addListener: (f) => (L[k] = f) });
const st = { local: { history: [] }, session: {}, contexts: [], created: [], removed: [], id: 100, windowsList: [] };
const area = (o) => ({
  get: async (k) => (typeof k === 'string' ? { [k]: o[k] } : Object.fromEntries((Array.isArray(k) ? k : []).map((x) => [x, o[x]]))),
  set: async (v) => Object.assign(o, v), remove: async () => {} });
globalThis.chrome = {
  tabs: { onCreated: ev('c'), onMoved: ev('m'), onAttached: ev('a'), onDetached: ev('d'), onUpdated: ev('u'), onRemoved: ev('removed'),
    create: async (o) => { const id = st.id++; st.created.push(o); st.contexts.push({ tabId: id, windowId: o.windowId, documentUrl: o.url }); return { id }; },
    update: async () => ({}), query: async (q) => (q.active ? [{ id: 5 }] : []),
    remove: async (ids) => { [].concat(ids).forEach((i) => st.removed.push(i)); st.contexts = st.contexts.filter((c) => ![].concat(ids).includes(c.tabId)); },
    sendMessage: async () => true },
  windows: { getAll: async () => st.windowsList, onCreated: ev('wc') },
  runtime: { onInstalled: ev('installed'), onStartup: ev('startup'), onMessage: ev('msg'), getURL: (p) => 'chrome-extension://id/' + p,
    getContexts: async () => st.contexts },
  storage: { local: area(st.local), session: area(st.session) },
  commands: { onCommand: ev('cmd') },
};
await import('../src/background/service-worker.js');
const send = (m, sender = {}) => new Promise((res) => L.msg(m, sender, res));
const stat = async (w) => (await send({ type: 'status', windowId: w })).state;

assert.equal(L.startup, undefined); assert.equal(L.wc, undefined); assert.equal(L.installed, undefined);
ok('no onStartup / onInstalled / windows.onCreated handlers — nothing runs on its own');

assert.equal(await stat(1), 'off'); ok('status off before user action');
await Promise.all([send({ type: 'protect', windowId: 1 }), send({ type: 'protect', windowId: 1 })]);
assert.equal(st.created.length, 1); ok('concurrent protect() creates exactly one guardian');
assert.equal(st.created[0].pinned, false); assert.equal(st.created[0].active, true); ok('guardian is unpinned and user-requested');
await send({ type: 'protect', windowId: 1 }); assert.equal(st.created.length, 1); ok('repeat protect() reuses existing guardian');
await send({ type: 'protect', windowId: 2 }); assert.equal(st.created.length, 2); ok('second window gets its own guardian');

// two guardians registering at the same instant must not clobber each other's nonce/prevTab state
// (uses two fresh windows so it doesn't consume the nonces the tests below still need)
await Promise.all([send({ type: 'protect', windowId: 3 }), send({ type: 'protect', windowId: 4 })]);
const g3 = st.contexts.find((c) => c.windowId === 3), g4 = st.contexts.find((c) => c.windowId === 4);
const [n3, n4] = [new URL(g3.documentUrl).searchParams.get('n'), new URL(g4.documentUrl).searchParams.get('n')];
const [r3, r4] = await Promise.all([
  send({ type: 'register', nonce: n3 }, { tab: { id: g3.tabId } }),
  send({ type: 'register', nonce: n4 }, { tab: { id: g4.tabId } }),
]);
assert.ok(r3.ok && r4.ok); ok('concurrent registration from two guardians both succeed');
assert.equal((await send({ type: 'register', nonce: n3 }, { tab: { id: g3.tabId } })).ok, false);
assert.equal((await send({ type: 'register', nonce: n4 }, { tab: { id: g4.tabId } })).ok, false);
ok('neither nonce is left re-usable after concurrent registration (no lost update)');

const nonce = new URL(st.created[0].url).searchParams.get('n'); const g1 = st.contexts[0].tabId;
assert.equal((await send({ type: 'register', nonce: 'bogus' }, { tab: { id: 999 } })).ok, false); ok('unknown/restored guardian is rejected (will self-close)');
assert.equal((await send({ type: 'register', nonce }, { tab: { id: g1 } })).ok, true);
assert.equal((await send({ type: 'register', nonce }, { tab: { id: g1 } })).ok, false); ok('token is one-time (reloaded guardian rejected)');
assert.equal(await stat(1), 'needs-click'); ok('status "needs-click" until user gesture');
await send({ type: 'armed' }, { tab: { id: g1 } });
assert.equal(await stat(1), 'armed'); assert.equal(await stat(2), 'needs-click'); ok('armed state is per window, not mixed');
L.removed(g1, { isWindowClosing: false }); st.contexts = st.contexts.filter((c) => c.tabId !== g1);
await new Promise((r) => setTimeout(r, 50)); assert.equal(await stat(1), 'off'); ok('closing guardian clears state; no respawn');
await send({ type: 'unprotect', windowId: 2 }); assert.equal(await stat(2), 'off'); ok('unprotect removes guardian');
assert.ok(st.created.every((o) => o.pinned !== true)); ok('no created tab is ever pinned');

// --- protect all windows
st.windowsList = [{ id: 30 }, { id: 31 }, { id: 32, incognito: true }];
const pa = await send({ type: 'protectAll' });
assert.equal(pa.count, 2); ok('protectAll reports only normal (non-incognito) windows');
assert.equal(st.created.filter((c) => c.windowId === 30).length, 1);
assert.equal(st.created.filter((c) => c.windowId === 31).length, 1);
assert.ok(!st.created.some((c) => c.windowId === 32)); ok('protectAll arms every normal window and skips incognito');

// --- keyboard shortcut command
const before2 = st.created.length;
L.cmd('open-recovery');
await new Promise((r) => setTimeout(r, 0));
assert.equal(st.created.length, before2 + 1);
assert.ok(st.created.at(-1).url.includes('recovery.html')); ok('open-recovery command opens the snapshots page');
process.exit(0);
