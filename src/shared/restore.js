export async function restoreWindows(windows) {
  for (const w of windows) {
    const win = await chrome.windows.create({ url: w.tabs.map((t) => t.url), focused: true });
    await Promise.all((win.tabs || []).map((t, i) =>
      w.tabs[i]?.pinned ? chrome.tabs.update(t.id, { pinned: true }).catch(() => {}) : null));
  }
}
export const openTab = (url) => chrome.tabs.create({ url });
