# AeroStudio

Userscript for Google AI Studio that unmounts older chat turns from the DOM so long sessions stay smooth when typing or scrolling. Your full history remains untouched on Google Drive.

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `Max Turns` | `2` | Recent turns kept visible in the DOM. |
| `Chat DOM Cap` | `1000` | Max visible chat DOM nodes before trimming (`0` to disable). |
| `Restore Step` | `3` | Turns brought back per `Restore` click. |
| `Memory Buffer` | `60` | Max detached turns kept in RAM before older ones are dropped. |

## Notes

- `Restore All` and `Status: Inactive` only bring back turns still inside `Memory Buffer`. Refresh (`F5`) to reload anything older from Google Drive.
- Reload the tab occasionally during very long sessions (hundreds of turns) so the browser can fully reclaim memory held by Angular.

## License

MIT