# Key Bindings

The editor toolbar, paragraph menus, application menu and command palette show the active key bindings for your platform. Changes in Preferences take effect in open editor windows without restarting. Clearing a binding removes its shortcut hint and disables that keyboard command; the menu action remains available. Restoring the default binding restores both the shortcut and its hint.

On Windows, `Ctrl+P` opens Quick Open. Print has no default shortcut and remains available from the File menu; you can assign it a different shortcut in Preferences.

Customize registered command shortcuts with the `keybindings.json` file. The file is located in the [application data directory](APPLICATION_DATA_DIRECTORY.md). Each entry maps a command ID to an accelerator string. Use the IDs exactly as listed in the platform tables, including capitalization.

Here is an example:

```json
{
  "file.save": "CmdOrCtrl+Shift+S",
  "file.save-as": "CmdOrCtrl+S"
}
```

## Available modifiers

- `Command` (alias `Cmd`) on macOS
- `Option` (alias `Alt`) on macOS
- `Control` (alias `Ctrl`)
- `Shift`
- `Alt` on Linux and Windows
- `CommandOrControl` (alias `CmdOrCtrl`), resolved for the current platform

Please don't bind `AltGr`, use `Ctrl+Alt` instead.

## Available keys

- `0-9`, `A-Z`, `F1-F24` and punctuations like `/` or `#`
- `Plus`, `Space`, `Tab`, `Backspace`, `Delete`, `Insert`, `Return/Enter`, `Esc`, `Home`, `End` and `PrintScreen`
- `Up`, `Down`, `Left` and `Right`
- `PageUp` and `PageDown`
- Empty string `""` to unset a accelerator

## Available key bindings

- [Key bindings for macOS](KEYBINDINGS_OSX.md)
- [Key bindings for Linux](KEYBINDINGS_LINUX.md)
- [Key bindings for Windows](KEYBINDINGS_WINDOWS.md)
