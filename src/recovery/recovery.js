import { countTabs } from '../shared/snapshot.js';
import { restoreWindows, openTab } from '../shared/restore.js';
import { mountIcons } from '../shared/icons.js';

const list = document.getElementById('list');
const el = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? '', className: cls ?? '' });
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };

async function render() {
  const { history = [] } = await chrome.storage.local.get('history');
  list.replaceChildren();
  if (!history.length) return list.append(el('p', 'No saved sessions yet. CLoops saves quietly in the background as you browse.', 'muted'));
  for (const s of history) {
    const box = el('details', '', 'card');
    const sum = el('summary');
    const info = el('div', '', 'grow');
    info.append(el('div', new Date(s.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })),
      el('div', `${s.windows.length} window${s.windows.length > 1 ? 's' : ''} · ${countTabs(s)} tabs`, 'muted small'));
    const btn = el('button', 'Restore all', 'btn primary');
    btn.addEventListener('click', (e) => { e.preventDefault(); restoreWindows(s.windows); });
    sum.append(info, btn);
    const tabs = el('div', '', 'tabs');
    s.windows.forEach((w, i) => {
      tabs.append(el('div', `Window ${i + 1}`, 'eyebrow w'));
      for (const t of w.tabs) { // textContent only: page titles are untrusted
        const b = el('button', '', 'tab'); b.title = t.url;
        b.append(el('span', t.title || host(t.url)), el('span', host(t.url), 'muted small'));
        b.addEventListener('click', () => openTab(t.url));
        tabs.append(b);
      }
    });
    box.append(sum, tabs); list.append(box);
  }
  mountIcons();
}
chrome.storage.onChanged.addListener(render);
mountIcons(); render();
