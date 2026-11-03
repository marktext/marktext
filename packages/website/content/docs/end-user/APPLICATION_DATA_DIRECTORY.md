# Application Data Directory

The per-user application data directory is located in the following directory:

- `%APPDATA%\marktext` on Windows
- `$XDG_CONFIG_HOME/marktext` or `~/.config/marktext` on Linux
- `~/Library/Application Support/marktext` on macOS

When [portable mode](PORTABLE.md) is enabled, the directory location is either the `--user-data-dir` parameter or `marktext-user-data` directory.

In the 0.24.0 development version, this directory includes:

| Path                                      | Purpose                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `preferences.json`                        | Validated user preferences.                                               |
| `keybindings.json`                        | Custom command shortcuts.                                                 |
| `state/application-state.json`            | Window/workspace metadata, layouts, open documents and reading positions. |
| `recovery/<window-id>/<document-id>.json` | Recovery records for unsaved document content.                            |

Startup and restoration options are described in [Preferences](PREFERENCES.md).
A development run uses the separate `marktext-dev` directory under the system's
application-data location.
