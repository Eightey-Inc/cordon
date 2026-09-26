import { countTabs, renameSnapshot, deleteSnapshot } from '../shared/snapshot.js';
import { restoreWindows, openTab } from '../shared/restore.js';
import { mountIcons } from '../shared/icons.js';
import { initTheme } from '../shared/theme.js';

const $ = (id) => document.getElementById(id);
const list = $('list');
const el = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? '', className: cls ?? '' });
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
const savedOn = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
const patch = async (fn) => {
  const { history = [] } = await chrome.storage.local.get('history');
  await chrome.storage.local.set({ history: fn(history) });
};

let query = '';
const openIds = new Set(); // <details> kept expanded across re-renders (rename/delete/search all rebuild the list)
let lastDeleted = null;
let undoTimer;

function matches(s, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  if ((s.name || '').toLowerCase().includes(needle)) return true;
  return s.windows.some((w) => w.tabs.some((t) => (t.title || '').toLowerCase().includes(needle) || host(t.url).toLowerCase().includes(needle)));
}
const tabMatches = (t, q) => !q || (t.title || '').toLowerCase().includes(q.toLowerCase()) || host(t.url).toLowerCase().includes(q.toLowerCase());

function showUndo(snap) {
  lastDeleted = snap;
  clearTimeout(undoTimer);
  $('toastMsg').textContent = `Deleted "${snap.name || savedOn(snap.time)}"`;
  $('toast').hidden = false;
  undoTimer = setTimeout(() => { $('toast').hidden = true; lastDeleted = null; }, 6000);
}
$('undo').addEventListener('click', async () => {
  if (!lastDeleted) return;
  clearTimeout(undoTimer);
  $('toast').hidden = true;
  const snap = lastDeleted; lastDeleted = null;
  openIds.add(snap.id);
  await patch((h) => (h.some((x) => x.id === snap.id) ? h : [...h, snap].sort((a, b) => b.time - a.time)));
});

async function render() {
  const { history = [] } = await chrome.storage.local.get('history');
  const shown = history.filter((s) => matches(s, query));
  list.replaceChildren();

  if (!history.length) { list.append(el('p', 'No saved sessions yet. Cordon saves quietly in the background as you browse.', 'muted')); return; }
  if (!shown.length) { list.append(el('p', `No snapshots match "${query}".`, 'muted')); return; }

  for (const s of shown) {
    const box = el('details', '', 'card snap');
    if (openIds.has(s.id)) box.open = true;
    box.addEventListener('toggle', () => { if (box.open) openIds.add(s.id); else openIds.delete(s.id); });
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
        setTimeout(async () => { await patch((h) => deleteSnapshot(h, s.id)); showUndo(s); }, 180);
      } else {
        delBtn.classList.add('confirm'); delBtn.title = 'Click again to delete';
        confirmTimer = setTimeout(() => { delBtn.classList.remove('confirm'); delBtn.title = 'Delete snapshot'; }, 2800);
      }
    });

    sum.append(titleWrap, restoreBtn, delBtn);

    const tabsEl = el('div', '', 'tabs');
    s.windows.forEach((w, i) => {
      const rows = w.tabs.filter((t) => tabMatches(t, query));
      if (!rows.length) return;
      tabsEl.append(el('div', `Window ${i + 1}`, 'eyebrow w'));
      for (const t of rows) { // textContent only: page titles are untrusted
        const b = el('button', '', 'tab'); b.title = t.url;
        b.append(el('span', t.title || host(t.url)), el('span', host(t.url), 'muted small'));
        b.addEventListener('click', () => openTab(t.url));
        tabsEl.append(b);
      }
    });
    box.append(sum, tabsEl);
    list.append(box);
  }
  mountIcons();
}

let debounce;
$('q').addEventListener('input', (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { query = e.target.value.trim(); render(); }, 150);
});

chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.history) render(); });
mountIcons(); initTheme(); render();
