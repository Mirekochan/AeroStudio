# StudioCore

A userscript that unmounts inactive chat turns from the DOM to fix input lag, typing delay, and tab crashes in [Google AI Studio](https://aistudio.google.com/).

## Preview

<img width="310" height="425" alt="StudioCore Preview" src="https://github.com/user-attachments/assets/cb8f9090-5fc0-46d7-9804-6f93bf9d1675" />

## Installation

1. Install [Violentmonkey](https://violentmonkey.github.io/) (recommended) or [Tampermonkey](https://www.tampermonkey.net/).
2. Install [aerostudio.user.js](https://github.com/Mirekochan/AeroStudio/raw/refs/heads/main/aerostudio.user.js).
3. Open `aistudio.google.com` and click the `<` button on the right edge to open the drawer (draggable to reposition).

*(Chrome users: Ensure **Developer mode** is toggled on in `chrome://extensions`).*

## Settings & Presets

Click any number box to edit, then press `Enter` or click outside to apply:

| Setting | Default | Recommended (Mobile / PC) | Description |
| :--- | :--- | :--- | :--- |
| `Max Turns` | `2` | `2–4` / `6–8` | Recent turns kept visible on screen. Older turns detach to memory pool. |
| `Chat DOM Cap` | `1000` | `800–1000` / `3000–4000` | Hard cap on DOM nodes in visible turns. Trims older turns when exceeded (`0` to disable). |
| `Restore Step` | `3` | `3` / `3` | Number of turns fetched back per `Restore` click. |
| `Memory Buffer` | `60` | `60` / `150` | Max detached turns preserved in RAM before dropping oldest entries. |

## Controls

- `Chat DOM | Total`: Live node counter (`Chat DOM`: visible turns; `Total`: full page DOM). Turns orange if a single message exceeds cap.
- `Status: Active / Inactive`: Master toggle. Setting to `Inactive` restores all detached messages immediately.
- `Restore (N)` / `Restore All`: Pull older turns from memory pool (auto-trimming is paused while reviewing history).
- `Purge / Reset`: Re-apply DOM limits and trim active chat back to configured thresholds.

## License

MIT