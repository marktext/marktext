# Command Line Interface

```
Usage: marktext [commands] [path ...]

  Available commands:

        --debug                   Enable debug mode
        --safe                    Disable plugins and other user configuration
    -n, --new-window              Open a new window on second-instance
        --user-data-dir           Change the user data directory
        --disable-gpu             Disable GPU hardware acceleration
        --disable-spellcheck      Disable the spell checker for this session
    -v, --verbose                 Be verbose
        --version                 Print version information
    -h, --help                    Print this help message
```

## Making `marktext` available in your shell

`marktext` has to point at your installation of MarkText. Where that is — and what you have
to do about it — varies from platform to platform.

### Linux

The `.deb` and `.rpm` packages already install `/usr/bin/marktext`, and the Snap exposes a
`marktext` command, so there is nothing to set up. For the AppImage or the tarball, alias the
binary you extracted:

```sh
alias marktext="$HOME/Applications/marktext.AppImage"
```

### macOS

```sh
alias marktext="/Applications/marktext.app/Contents/MacOS/marktext"
```

### Windows

Add the installation directory to your `PATH` — `%LOCALAPPDATA%\Programs\marktext` for a
default install — or save a wrapper like this one as `marktext.cmd` in a directory that is
already on it:

```bat
@echo off
"%LOCALAPPDATA%\Programs\marktext\marktext.exe" %*
```

Do **not** put a symlink, a hard link or a lone copy of `marktext.exe` on your `PATH`.
Chromium looks for `icudtl.dat` and the other bundled resources in the directory of the
executable path it was launched from, and Windows reports the link's own path rather than the
target's. MarkText then aborts before it starts, printing only:

```
[ERROR:base\i18n\icu_util.cc:232] Invalid file descriptor to ICU data received.
```

Linking is safe on Linux — `/usr/bin/marktext` from the `.deb` and `.rpm` packages is itself a
symlink into `/opt/marktext` — because the kernel resolves the link before the process starts.
