# StudioCore

A userscript that unmounts old chat turns from the DOM to fix lag and typing delay in [Google AI Studio](https://aistudio.google.com/).

## Preview

<img width="310" height="425" alt="{F0776D52-77BF-4666-952F-98A49D776AAA}" src="https://github.com/user-attachments/assets/cb8f9090-5fc0-46d7-9804-6f93bf9d1675" />

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) (Recommend)
2. Install [aerostudio.user.js](https://github.com/Mirekochan/AeroStudio/raw/refs/heads/main/aerostudio.user.js)
3. Open `aistudio.google.com` and click the `<` button on the right edge to open the drawer (you can drag the `<` button up or down to reposition it)

## Settings

Click any number box to edit, then press `Enter` or click outside the box to apply:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `Max Turns` | `2` | Maximum number of recent chat turns kept on screen. Older turns are detached into the memory pool. |
| `Chat DOM Cap` | `1000` | Hard limit on DOM nodes inside visible turns. If a turn has huge code blocks and pushes `Chat DOM` over this cap, older turns are trimmed automatically (always leaves at least the latest turn visible). Set to `0` to disable. |
| `Restore Step` | `3` | Number of older turns brought back each time you click `Restore`. |
| `Memory Buffer` | `60` | Maximum detached turns stored in RAM. Oldest turns beyond this limit are cleared to save memory. |

## Controls & Usage

- `Chat DOM | Total` - Live counter at the top (`Chat DOM` counts nodes inside visible messages; `Total` counts the whole page including AI Studio's UI). Turns green when under the cap, orange when a single huge message exceeds `Chat DOM Cap`.
- `Status: Active / Inactive` - Toggle the script on or off. Turning it `Inactive` immediately puts all detached messages back into the chat.
- `Restore (N)` / `Restore All` - Bring back older messages from the pool when you want to read history. While reading restored messages, auto-trimming is paused so they won't get cut again.
- `Purge / Reset` - Click this after reading history to trim the chat back down to your `Max Turns` and `Chat DOM Cap` limits.

## Recommended Values

- **Mobile (fixes keyboard typing delay):** `Max Turns: 2` (or `4`), `Chat DOM Cap: 800–1000`, `Memory Buffer: 60`
- **Desktop PC:** `Max Turns: 6–8`, `Chat DOM Cap: 3000–4000`, `Memory Buffer: 150`

## License

MIT
