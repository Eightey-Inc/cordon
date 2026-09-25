// Applies the user's theme choice (light / dark / system) by setting data-theme on <html>.
// ui.css reads that attribute; when it is absent or "system", the OS preference decides.
import { getSettings, setSettings } from './storage.js';

const ORDER = ['system', 'light', 'dark'];
export const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };
export const THEME_LABEL = { system: 'Auto (system)', light: 'Light', dark: 'Dark' };

const apply = (theme) => { document.documentElement.dataset.theme = theme; };

export async function initTheme() {
  const { theme } = await getSettings();
  apply(theme);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) apply(changes.theme.newValue || 'system');
  });
  return theme;
}

export async function setTheme(theme) {
  await setSettings({ theme });
  apply(theme);
}

export async function cycleTheme() {
  const { theme } = await getSettings();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  await setTheme(next);
  return next;
}
