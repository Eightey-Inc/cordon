import { getSettings } from '../shared/storage.js';
import { countTabs } from '../shared/snapshot.js';
import { restoreWindows } from '../shared/restore.js';
import { RECOVERY_PATH } from '../shared/constants.js';
import { mountIcons, setIcon } from '../shared/icons.js';
import { initTheme, cycleTheme, THEME_ICON, THEME_LABEL } from '../shared/theme.js';

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);
const STATE_TEXT = {
  off: ['Not protected', 'Turn on to confirm before this window closes.', 'shield'],
  'needs-click': ['One click to finish', 'Not active yet. Click the Cordon tab.', 'alert'],
  armed: ['Protected', 'Chrome will ask before this window closes.', 'shield-check'],
};
let windowId;

// Guardian state can change on its own (the user clicks the guardian tab, or closes it), so this
// polls; there's no push event for it. The icon is only touched when the state actually changed,
// so its entry animation doesn't replay on every poll.
async function renderStatus() {
  windowId ??= (await chrome.windows.getCurrent()).id;
  const { state } = await send({ type: 'status', windowId });
  const [label, detail, iconName] = STATE_TEXT[state];
  $('status').dataset.state = state;
  $('label').textContent = label; $('detail').textContent = detail;
  if ($('stateIcon').dataset.icon !== iconName) setIcon($('stateIcon'), iconName);
  $('toggle').checked = state !== 'off';
  $('goto').hidden = state !== 'needs-click';
}

// Backup info only changes when storage changes, so this is event-driven rather than polled.
async function renderBackup() {
  const { autoSave } = await getSettings();
  const { history = [] } = await chrome.storage.local.get('history');
  const head = history[0];
  $('backup').textContent = !autoSave ? 'Saving is paused'
    : head ? `Saved ${new Date(head.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} \u00b7 ${countTabs(head)} tabs`
    : 'Your first snapshot will appear shortly';
  $('restore').disabled = !head;
}

$('toggle').addEventListener('change', async (e) => {
  await send({ type: e.target.checked ? 'protect' : 'unprotect', windowId });
  renderStatus();
});
$('goto').addEventListener('click', () => send({ type: 'protect', windowId }));
$('protectAll').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const label = btn.lastChild; // trailing text node after the icon
  btn.disabled = true;
  const r = await send({ type: 'protectAll' });
  btn.disabled = false;
  label.textContent = r?.count ? `Protected ${r.count} window${r.count === 1 ? '' : 's'}` : 'Protect all open windows';
  renderStatus();
  setTimeout(() => { label.textContent = 'Protect all open windows'; }, 2500);
});
$('restore').addEventListener('click', async () => {
  const { history = [] } = await chrome.storage.local.get('history');
  if (history[0]) { await restoreWindows(history[0].windows); window.close(); }
});
$('recovery').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL(RECOVERY_PATH) }));
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.commands?.getAll?.().then((cmds) => {
  const shortcut = cmds.find((c) => c.name === 'open-recovery')?.shortcut;
  $('recovery').title = shortcut ? `Shortcut: ${shortcut}` : 'Set a keyboard shortcut in Settings';
});

async function renderTheme() {
  const { theme } = await getSettings();
  setIcon($('theme').firstElementChild, THEME_ICON[theme]);
  $('theme').title = `Theme: ${THEME_LABEL[theme]} (click to change)`;
}
$('theme').addEventListener('click', async () => { await cycleTheme(); renderTheme(); });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.history || changes.autoSave) renderBackup();
  if (changes.theme) renderTheme();
});

mountIcons(); initTheme().then(renderTheme);
renderStatus(); renderBackup();
setInterval(renderStatus, 1500);
