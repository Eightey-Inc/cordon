# Cordon Protection (Beta 1.0.6)

A free, open-source Chromium extension that asks for confirmation before you close a window, so you don't lose your tabs by accident.

- **Source:** https://github.com/Eightey-Inc/cordon
- **Website:** https://getcordon.vercel.app

## What it is

Cordon Protection adds a native confirmation dialog when you try to close a protected window. It also keeps local session snapshots you can restore from, just in case.

There is no extension API to intercept the browser's close button, so Cordon uses a small "guardian" tab with a `beforeunload` handler. Chromium only shows the confirmation if that page has had a real user click first, so you click once per window to arm it.

Works on Chrome and all Chromium-based browsers (Edge, Brave, Opera, Vivaldi, and others).

## Install (unpacked)

1. Open your browser's extensions page (e.g. `chrome://extensions`, `edge://extensions`, `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. If an older build was already loaded, click **Reload** on it.

## How to use

1. Click the Cordon Protection icon and turn on **Protect this window**.
2. A small "Cordon protection" tab opens. Click anywhere on it once to arm protection.
3. You're switched back to your previous tab, and the popup shows **Protected**.
4. Repeat for each window. Protection is opt-in every session.

When you close a protected window, the browser asks for confirmation. Cancel keeps it open, Continue closes it.

## Known limitations

- One click per window per session; the guardian tab stays in the tab strip.
- The confirmation dialog text is generic and can't be customized.
- If the browser skips the prompt, Cordon can't stop it.
- Crash, force quit, OS shutdown, and incognito are unsupported.

## Session backup

Snapshots (URL, title, pinned state) are saved locally and can be restored from the popup or the snapshots page. Restoring re-pins tabs that were pinned when saved. Nothing restores automatically.

On the snapshots page you can:
- **Rename** a snapshot: click the pencil next to its title and type a name. Leave it blank to go back to the default date-based title. The name is kept even as that snapshot keeps auto-updating in the background.
- **Delete** a snapshot: click the trash icon once to arm it (it turns red and asks for a second click), then click again within a few seconds to remove it. Clicking elsewhere cancels.
- **Keep more history**: choose 5, 10, 20 or up to 30 snapshots in Settings.

## What changed in 1.0.6

- **Protect all windows:** a new button in the popup arms every open normal window in one click, instead of one at a time.
- **Search:** the snapshots page has a search box that filters by tab title or site, both which snapshots are shown and which tabs are listed inside an expanded one.
- **Undo:** deleting a snapshot now shows a brief "Undo" toast at the bottom of the snapshots page instead of only the two-click confirm.
- **Export / import:** Settings can export all snapshots to a JSON file, and import one back in (merges with what you already have; malformed entries are skipped and reported).
- **Keyboard shortcut:** an "open snapshots" command is registered but has no default key combo, so it can't collide with anything you already use. Assign one from Settings → Keyboard shortcut, or directly at `chrome://extensions/shortcuts`. Once set, the popup's "All snapshots" button shows it as a tooltip.
- Fixed along the way: renaming or deleting a snapshot used to collapse every other expanded snapshot on the page, since the whole list re-renders on any change. Expanded state is now tracked and restored.

None of this has been exercised in a real browser. In particular, please check: protecting several real windows at once, that an imported file actually restores correctly, that the keyboard shortcut fires once assigned, and that undo restores a deleted snapshot in the right position.

## What changed in 1.0.5

- **Fixed:** the rename and delete icons on the snapshots page rendered solid black. The dynamically created buttons were missing the wrapper element that carries the icon's color and sizing rules, so the browser fell back to a default black-filled SVG. They now use the same icon markup as the rest of the app and pick up the theme color correctly.
- **Theme:** Settings has a Light / Dark / Auto (system) control. Auto follows the OS; Light and Dark are pinned regardless of OS setting. The choice is stored and applied on every page (popup, the protection tab, settings, snapshots), and a matching quick-toggle icon sits in the popup header. All icons use the current theme's color automatically, since they're drawn with the theme's text color rather than a fixed one.
- **Project links:** Settings has a "Project" section linking to the source repository and the website.

This has not been checked in a real browser: please confirm the icons now look right in both themes, that switching themes updates every open Cordon page/tab, and that the links open correctly.

## What changed in 1.0.4

- Snapshots can now be renamed and deleted individually, and history can hold up to 30.
- Guardian, settings and snapshot pages now declare an explicit tab icon. The previous build had none, so Chromium likely fell back to a generic page icon in the tab strip instead of Cordon's logo — this is the probable cause of the reported "protection icon not visible in guardian tab," though it has not been re-verified in a real browser.
- Small interface pass: consistent hover/press feedback on buttons, a smoother toggle switch, an animated checkmark when a window becomes protected, and a fade/collapse when a snapshot is deleted. Still no emoji — only the existing custom line icons plus one new one (rename/pencil).
- New logic (rename, delete, the 30-snapshot cap, and that a custom name survives automatic snapshot updates) is covered by the Node test suite below, but nothing in this release has been exercised in a real Chromium browser yet.

## Permissions

- **storage** — settings, snapshots, and temporary guardian state.
- **tabs** — reads tab URLs and titles for snapshots and finds guardian tabs. Chromium words this as "read your browsing history." Nothing leaves your device.

## Privacy

No network calls, no analytics, no accounts. Only http(s) tabs in normal windows are saved. Incognito is excluded.

## Testing

`node tests/run.mjs` runs 22 checks against a **mocked** Chrome API (snapshot logic, rename/delete/cap behavior, and the guardian's per-window state machine). These confirm Cordon's own logic, not how Chromium actually behaves — please test manually in a real browser: rename and delete a few snapshots, save 30+ snapshots and confirm the oldest drop off, and check the guardian tab's icon in the tab strip.

## Credits

Published and operated by Eightey Inc.

- **Eightey** — core features and UI
- **bitown** — bug fixes and popup development
