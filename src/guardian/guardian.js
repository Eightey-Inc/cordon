// The beforeunload handler is added only AFTER a real user gesture, so Chrome never blocks
// a prompt for a frame without activation. No synthetic events, no retries.
import { mountIcons, setIcon } from '../shared/icons.js';
import { initTheme } from '../shared/theme.js';

const $ = (id) => document.getElementById(id);
const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
initTheme(); mountIcons();

chrome.runtime.onMessage.addListener((m, _s, send) => {
  if (m.type === 'disarm') { removeEventListener('beforeunload', handler); send(true); }
});

function show(title, desc, { button = false } = {}) {
  $('title').textContent = title; $('desc').textContent = desc; $('arm').hidden = !button;
}

async function arm() {
  if (!navigator.userActivation.hasBeenActive) {
    show('That click was not registered', 'Chrome needs a direct click or key press on this page. Please try again.', { button: true });
    return;
  }
  removeEventListener('click', arm); removeEventListener('keydown', arm);
  addEventListener('beforeunload', handler);
  await chrome.runtime.sendMessage({ type: 'armed' });
  $('mark').innerHTML = '<span class="done"><i class="i" data-icon="check"></i></span>'; mountIcons();
  show('Protection is on', 'Chrome will now ask before this window closes. You can keep working; this tab can stay in the background.');
}

(async () => {
  const nonce = new URLSearchParams(location.search).get('n');
  const r = await chrome.runtime.sendMessage({ type: 'register', nonce }).catch(() => null);
  if (!r?.ok) { // restored by Chrome, reloaded or stale: not requested by the user this session
    const t = await chrome.tabs.getCurrent();
    if (t) chrome.tabs.remove(t.id);
    return;
  }
  show('Turn on protection for this window', 'One click lets Chrome show its close confirmation. This is a browser rule: pages can only prompt after you have interacted with them.', { button: true });
  $('arm').focus();
  addEventListener('click', arm); addEventListener('keydown', arm);
})();
