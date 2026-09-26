import { getSettings, setSettings } from '../shared/storage.js';
import { mergeHistory } from '../shared/snapshot.js';
import { mountIcons } from '../shared/icons.js';
import { initTheme, setTheme } from '../shared/theme.js';

const $ = (id) => document.getElementById(id);
mountIcons();

async function renderTheme() {
  const { theme } = await getSettings();
  $('theme').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === theme)));
}
$('theme').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  await setTheme(btn.dataset.value);
  renderTheme();
});

initTheme().then(renderTheme);
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

$('export').addEventListener('click', async () => {
  const { history = [] } = await chrome.storage.local.get('history');
  const blob = new Blob([JSON.stringify({ app: 'cordon', exportedAt: Date.now(), history }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `cordon-snapshots-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  $('importStatus').textContent = `Exported ${history.length} snapshot${history.length === 1 ? '' : 's'}.`;
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const items = Array.isArray(data) ? data : data.history;
    if (!Array.isArray(items)) throw new Error('unexpected format');
    const { maxSnapshots } = await getSettings();
    const { history = [] } = await chrome.storage.local.get('history');
    const { history: merged, added, skipped } = mergeHistory(history, items, maxSnapshots);
    await chrome.storage.local.set({ history: merged });
    $('importStatus').textContent = skipped
      ? `Imported ${added}, skipped ${skipped} that didn't look like a snapshot.`
      : `Imported ${added} snapshot${added === 1 ? '' : 's'}.`;
  } catch {
    $('importStatus').textContent = "Couldn't read that file — expected a Cordon export.";
  }
});

$('shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

$('ver').textContent = chrome.runtime.getManifest().version_name;
