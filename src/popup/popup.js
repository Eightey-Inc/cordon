import { getSettings } from '../shared/storage.js';
import { countTabs } from '../shared/snapshot.js';
import { restoreWindows } from '../shared/restore.js';
import { RECOVERY_PATH } from '../shared/constants.js';
import { mountIcons, setIcon } from '../shared/icons.js';

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);
const TEXT = {
  off: ['Not protected', 'Turn on to confirm before this window closes.', 'shield'],
  'needs-click': ['One click to finish', 'Not active yet. Click the CLoops tab.', 'alert'],
  armed: ['Protected', 'Chrome will ask before this window closes.', 'shield-check'],
};
let windowId;

async function render() {
  windowId ??= (await chrome.windows.getCurrent()).id;
  const { state } = await send({ type: 'status', windowId });
  const [label, detail, icon] = TEXT[state];
  $('status').dataset.state = state;
  $('label').textContent = label; $('detail').textContent = detail;
  setIcon($('stateIcon'), icon);
  $('toggle').checked = state !== 'off';
  $('goto').hidden = state !== 'needs-click';
  const { autoSave } = await getSettings();
  const { history = [] } = await chrome.storage.local.get('history');
  const head = history[0];
  $('backup').textContent = !autoSave ? 'Saving is paused'
    : head ? `Saved ${new Date(head.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${countTabs(head)} tabs`
    : 'Your first snapshot will appear shortly';
  $('restore').disabled = !head;
}

$('toggle').addEventListener('change', async (e) => {
  await send({ type: e.target.checked ? 'protect' : 'unprotect', windowId });
  render();
});
$('goto').addEventListener('click', () => send({ type: 'protect', windowId }));
$('restore').addEventListener('click', async () => {
  const { history = [] } = await chrome.storage.local.get('history');
  if (history[0]) { await restoreWindows(history[0].windows); window.close(); }
});
$('recovery').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL(RECOVERY_PATH) }));
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
mountIcons(); render();
setInterval(render, 1500);
