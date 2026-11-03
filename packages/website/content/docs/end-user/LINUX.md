# Linux Installation Notes

See [Installation](INSTALLATION.md#linux) for supported package formats and
architecture choices. The names below use the current packaging configuration;
replace `<version>` with the downloaded release version.

## AppImage

Download the matching file from [GitHub releases](https://github.com/marktext/marktext/releases/latest).
For x64:

```sh
chmod +x marktext-linux-<version>.AppImage
./marktext-linux-<version>.AppImage
```

For arm64, use `marktext-linux-arm64-<version>.AppImage`. An AppImage runs
directly and still requires compatible system libraries.

### Desktop integration

You can create a desktop entry from the repository's
[template](https://github.com/marktext/marktext/blob/develop/packages/desktop/build/linux/marktext.desktop):

```sh
mkdir -p "$HOME/.local/share/applications"
curl -fL https://raw.githubusercontent.com/marktext/marktext/develop/packages/desktop/build/linux/marktext.desktop -o "$HOME/.local/share/applications/marktext.desktop"
```

Edit both `Exec=` entries to use the absolute path to your AppImage, preserving
`%F` and the New Window action's `--new-window` flag. Set `Icon=` to an installed
MarkText icon or an absolute icon path, then refresh the desktop database if the
utility is available:

```sh
update-desktop-database "$HOME/.local/share/applications"
```

### Custom launch script

If the AppImage is stored at `~/bin/marktext.AppImage`, a wrapper can forward
files and command-line options:

```sh
#!/bin/sh
exec "$HOME/bin/marktext.AppImage" "$@"
```

### Uninstallation

Delete the AppImage and any desktop entry or wrapper you created. To remove
settings and recovery data too, see [Application data directory](APPLICATION_DATA_DIRECTORY.md).

## Tarball

Use `marktext-linux-<version>.tar.gz` for x64 or
`marktext-linux-arm64-<version>.tar.gz` for arm64. Extract the complete archive
and run the included `marktext` executable with its resources alongside it.

## Chromium sandbox

If startup reports an SUID sandbox-helper error, check the distribution's
sandbox configuration and the package's `chrome-sandbox` ownership and
permissions. AppImage mounts and extracted archives can behave differently from
installed packages. A deb or rpm package can be easier to integrate on a
matching distribution. Do not change permissions on unrelated system files;
follow your distribution's sandbox guidance.

## Arch User Repository

Community AUR packages are maintained independently of MarkText. Check the
[marktext-bin package](https://aur.archlinux.org/packages/marktext-bin) and its
PKGBUILD for the version, architecture and dependencies before installing.
For that package, the checkout name must match the repository:

```sh
git clone https://aur.archlinux.org/marktext-bin.git
cd marktext-bin
makepkg -si
```
