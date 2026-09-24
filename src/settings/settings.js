import { getSettings, setSettings } from '../shared/storage.js';
import { mountIcons } from '../shared/icons.js';
const $ = (id) => document.getElementById(id);
mountIcons();
getSettings().then((s) => { $('toggle').checked = s.autoSave; $('max').value = String(s.maxSnapshots); });
$('toggle').addEventListener('change', (e) => setSettings({ autoSave: e.target.checked }));
$('max').addEventListener('change', async (e) => {
  const max = Number(e.target.value);
  await setSettings({ maxSnapshots: max });
  const { history = [] } = await chrome.storage.local.get('history');
  await chrome.storage.local.set({ history: history.slice(0, max) });
});
$('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove('history');
  $('cleared').textContent = 'All saved sessions cleared.';
});
$('ver').textContent = chrome.runtime.getManifest().version_name;
