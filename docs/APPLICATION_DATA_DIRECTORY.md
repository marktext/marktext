# Application Data Directory

The per-user application data directory is located in the following directory:

- `%APPDATA%\marktext` on Windows
- `$XDG_CONFIG_HOME/marktext` or `~/.config/marktext` on Linux
- `~/Library/Application Support/marktext` on macOS

When [portable mode](PORTABLE.md) is enabled, the directory location is either the `--user-data-dir` parameter or `marktext-user-data` directory.
