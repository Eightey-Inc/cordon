# Cordon Protection

A free, open-source Chromium extension that asks for confirmation before you close a window, so you don't lose your tabs by accident.
## What it is

Cordon Protection adds a native confirmation dialog when you try to close a protected window. It also keeps local session snapshots you can restore from, just in case.

There is no extension API to intercept the browser's close button, so Cordon uses a small "guardian" tab with a `beforeunload` handler. Chromium only shows the confirmation if that page has had a real user click first, so you click once per window to arm it.

Works on Chrome and all Chromium-based browsers (Edge, Brave, Opera, Vivaldi, and others).

## Install (unpacked)

1. Download the latest release and extract the .zip file.
2. Open your browser's extensions page (e.g. `chrome://extensions`, `edge://extensions`, `brave://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.
5. If an older build was already loaded, click **Reload** on it.

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

## Permissions

- **storage** — settings, snapshots, and temporary guardian state.
- **tabs** — reads tab URLs and titles for snapshots and finds guardian tabs. Chromium words this as "read your browsing history." Nothing leaves your device.

## Privacy

No network calls, no analytics, no accounts. Only http(s) tabs in normal windows are saved. Incognito is excluded.

## Credits

Published and operated by Eightey Inc.

- **Eightey** — core features and UI
- **bitown** — bug fixes and popup development
