// Custom line icons (24px grid). Static strings only; no emoji, no external assets.
const P = {
  shield: '<path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6l7-3z"/>',
  'shield-check': '<path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6l7-3z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5V9h4.5"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5 9-5z"/><path d="M3 14l9 5 9-5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  trash: '<path d="M5 7h14M9.5 7V5h5v2M7 7l1 12h8l1-12"/>',
  window: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const LOGO = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="30" fill="#2447E0"/><path d="M89.2 83.7A32 32 0 1 1 89.2 44.3" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/><circle cx="64" cy="64" r="8" fill="#fff"/></svg>';

export function setIcon(el, name) {
  el.dataset.icon = name;
  el.innerHTML = name === 'logo' ? LOGO : `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
export const mountIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
