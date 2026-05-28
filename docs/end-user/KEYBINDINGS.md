# Key Bindings

All key bindings can be overwritten with the `keybindings.json` file. The file is located in the [application data directory](APPLICATION_DATA_DIRECTORY.md). Each entry consists of a `id`/`accelerator` pair in JSON format.

Here is an example:

```json
{
  "file.save": "CmdOrCtrl+Shift+S",
  "file.save-as": "CmdOrCtrl+S"
}
```

## Available modifiers

- `Cmd` on macOS
- `Option` on macOS
- `Ctrl`
- `Shift`
- `Alt` (equal to `Option` on macOS)

Please don't bind `AltGr`, use `Cltr+Alt` instead.

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
