// Node tests against a MOCKED chrome API. They check our logic, not Chrome's behavior.
import assert from 'node:assert/strict';
import { buildSnapshot, addSnapshot, countTabs } from '../src/shared/snapshot.js';

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

// --- mocked chrome
const L = {}; const ev = (k) => ({ addListener: (f) => (L[k] = f) });
const st = { local: { history: [] }, session: {}, contexts: [], created: [], removed: [], id: 100 };
const area = (o) => ({
  get: async (k) => (typeof k === 'string' ? { [k]: o[k] } : Object.fromEntries((Array.isArray(k) ? k : []).map((x) => [x, o[x]]))),
  set: async (v) => Object.assign(o, v), remove: async () => {} });
globalThis.chrome = {
  tabs: { onCreated: ev('c'), onMoved: ev('m'), onAttached: ev('a'), onDetached: ev('d'), onUpdated: ev('u'), onRemoved: ev('removed'),
    create: async (o) => { const id = st.id++; st.created.push(o); st.contexts.push({ tabId: id, windowId: o.windowId, documentUrl: o.url }); return { id }; },
    update: async () => ({}), query: async (q) => (q.active ? [{ id: 5 }] : []),
    remove: async (ids) => { [].concat(ids).forEach((i) => st.removed.push(i)); st.contexts = st.contexts.filter((c) => ![].concat(ids).includes(c.tabId)); },
    sendMessage: async () => true },
  windows: { getAll: async () => [], onCreated: ev('wc') },
  runtime: { onInstalled: ev('installed'), onStartup: ev('startup'), onMessage: ev('msg'), getURL: (p) => 'chrome-extension://id/' + p,
    getContexts: async () => st.contexts },
  storage: { local: area(st.local), session: area(st.session) },
};
await import('../src/background/service-worker.js');
const send = (m, sender = {}) => new Promise((res) => L.msg(m, sender, res));
const stat = async (w) => (await send({ type: 'status', windowId: w })).state;

assert.equal(L.startup, undefined); assert.equal(L.wc, undefined); ok('no onStartup / windows.onCreated handlers');
await L.installed({ reason: 'install' }); assert.equal(st.created.length, 0); ok('nothing opened on install');

assert.equal(await stat(1), 'off'); ok('status off before user action');
await Promise.all([send({ type: 'protect', windowId: 1 }), send({ type: 'protect', windowId: 1 })]);
assert.equal(st.created.length, 1); ok('concurrent protect() creates exactly one guardian');
assert.equal(st.created[0].pinned, false); assert.equal(st.created[0].active, true); ok('guardian is unpinned and user-requested');
await send({ type: 'protect', windowId: 1 }); assert.equal(st.created.length, 1); ok('repeat protect() reuses existing guardian');
await send({ type: 'protect', windowId: 2 }); assert.equal(st.created.length, 2); ok('second window gets its own guardian');

const nonce = new URL(st.created[0].url).searchParams.get('n'); const g1 = st.contexts[0].tabId;
assert.equal((await send({ type: 'register', nonce: 'bogus' }, { tab: { id: 999 } })).ok, false); ok('unknown/restored guardian is rejected (will self-close)');
assert.equal((await send({ type: 'register', nonce }, { tab: { id: g1 } })).ok, true);
assert.equal((await send({ type: 'register', nonce }, { tab: { id: g1 } })).ok, false); ok('token is one-time (reloaded guardian rejected)');
assert.equal(await stat(1), 'needs-click'); ok('status "needs-click" until user gesture');
await send({ type: 'armed' }, { tab: { id: g1 } });
assert.equal(await stat(1), 'armed'); assert.equal(await stat(2), 'needs-click'); ok('armed state is per window, not mixed');
L.removed(g1, { isWindowClosing: false }); st.contexts = st.contexts.filter((c) => c.tabId !== g1);
await new Promise((r) => setTimeout(r, 50)); assert.equal(await stat(1), 'off'); ok('closing guardian clears state; no respawn');
assert.equal(st.created.length, 2); 
await send({ type: 'unprotect', windowId: 2 }); assert.equal(await stat(2), 'off'); ok('unprotect removes guardian');
assert.ok(st.created.every((o) => o.pinned !== true)); ok('no created tab is ever pinned');
process.exit(0);
