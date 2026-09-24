import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS))) };
  } catch (e) {
    console.warn('Cloops: storage read failed', e.message);
    return { ...DEFAULT_SETTINGS };
  }
}

export const setSettings = (patch) => chrome.storage.local.set(patch);
