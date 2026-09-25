import { countTabs, renameSnapshot, deleteSnapshot } from '../shared/snapshot.js';
import { restoreWindows, openTab } from '../shared/restore.js';
import { mountIcons } from '../shared/icons.js';
import { initTheme } from '../shared/theme.js';

const list = document.getElementById('list');
const el = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? '', className: cls ?? '' });
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
const savedOn = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
const patch = async (fn) => {
  const { history = [] } = await chrome.storage.local.get('history');
  await chrome.storage.local.set({ history: fn(history) });
};

async function render() {
  const { history = [] } = await chrome.storage.local.get('history');
  list.replaceChildren();
  if (!history.length) { list.append(el('p', 'No saved sessions yet. Cordon saves quietly in the background as you browse.', 'muted')); return; }

  for (const s of history) {
    const box = el('details', '', 'card snap');
    const sum = el('summary');

    const titleWrap = el('div', '', 'grow');
    const titleRow = el('div', '', 'title-row');
    const titleEl = el('span', s.name || savedOn(s.time), 'title');
    const editBtn = el('button', '', 'btn ghost icon-btn'); editBtn.title = 'Rename';
    editBtn.append(Object.assign(document.createElement('i'), { className: 'i' }));
    editBtn.firstChild.dataset.icon = 'edit';
    titleRow.append(titleEl, editBtn);
    const meta = el('div', `Saved ${savedOn(s.time)} \u00b7 ${s.windows.length} window${s.windows.length > 1 ? 's' : ''} \u00b7 ${countTabs(s)} tabs`, 'muted small');
    titleWrap.append(titleRow, meta);

    editBtn.addEventListener('click', (e) => {
      stop(e);
      const input = Object.assign(document.createElement('input'), { className: 'rename', value: s.name || '', placeholder: savedOn(s.time) });
      titleRow.replaceChild(input, titleEl);
      editBtn.hidden = true;
      input.focus(); input.select();
      const commit = () => patch((h) => renameSnapshot(h, s.id, input.value));
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        else if (ke.key === 'Escape') { input.value = s.name || ''; input.blur(); }
      });
      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('click', (ie) => ie.stopPropagation());
    });

    const restoreBtn = el('button', 'Restore all', 'btn primary');
    restoreBtn.addEventListener('click', (e) => { stop(e); restoreWindows(s.windows); });

    const delBtn = el('button', '', 'btn ghost icon-btn danger'); delBtn.title = 'Delete snapshot';
    delBtn.append(Object.assign(document.createElement('i'), { className: 'i' }));
    delBtn.firstChild.dataset.icon = 'trash';
    let confirmTimer;
    delBtn.addEventListener('click', (e) => {
      stop(e);
      if (delBtn.classList.contains('confirm')) {
        clearTimeout(confirmTimer);
        box.classList.add('leaving');
        box.style.maxHeight = box.offsetHeight + 'px';
        requestAnimationFrame(() => { box.style.maxHeight = '0px'; });
        setTimeout(() => patch((h) => deleteSnapshot(h, s.id)), 180);
      } else {
        delBtn.classList.add('confirm'); delBtn.title = 'Click again to delete';
        confirmTimer = setTimeout(() => { delBtn.classList.remove('confirm'); delBtn.title = 'Delete snapshot'; }, 2800);
      }
    });

    sum.append(titleWrap, restoreBtn, delBtn);

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
    box.append(sum, tabs);
    list.append(box);
  }
  mountIcons();
}
chrome.storage.onChanged.addListener(render);
mountIcons(); initTheme(); render();
