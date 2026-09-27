import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS))) };
  } catch (e) {
    console.warn('Cordon: storage read failed', e.message);
    return { ...DEFAULT_SETTINGS };
  }
}

export const setSettings = (patch) => chrome.storage.local.set(patch);

// Serializes every read-modify-write of the snapshot history made from this page, so that two
// actions fired close together (rename + delete, delete + undo, import + clear...) can't race
// and silently drop one of them. Each page gets its own queue (this module is a fresh instance
// per page); it does not protect against edits from two different open Cordon tabs at once.
let historyChain = Promise.resolve();
export function patchHistory(mutate) {
  const p = historyChain.then(async () => {
    const { history = [] } = await chrome.storage.local.get('history');
    const next = await mutate(history);
    await chrome.storage.local.set({ history: next });
    return next;
  });
  historyChain = p.catch(() => {});
  return p;
}
export function clearHistory() {
  const p = historyChain.then(() => chrome.storage.local.remove('history'));
  historyChain = p.catch(() => {});
  return p;
}
