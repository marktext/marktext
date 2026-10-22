# Installation

MarkText is a free, open-source Markdown editor for **Linux**, **macOS** and **Windows**. Pre-built binaries are published with every release on [GitHub releases](https://github.com/marktext/marktext/releases/latest). Pick the one that matches your platform.

## Windows

| Artifact                               | When to choose                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `marktext-win-x64-<version>-setup.exe` | Recommended. NSIS installer; per-user install, lets you pick the install directory, creates Start Menu and Desktop shortcuts.               |
| `marktext-win-x64-<version>.zip`       | Portable zip. Extract anywhere and run `marktext.exe`. See [Portable mode](PORTABLE.md) for details on keeping your data alongside the app. |

For Windows on ARM, choose the corresponding `marktext-win-arm64-<version>-setup.exe` or `.zip` artifact.

After installing, MarkText registers itself as a handler for `.md`, `.markdown`, `.mmd`, `.mdown`, `.mdtxt` and `.mdtext` files.

## macOS

The current application requires macOS 12 (Monterey) or later; see [supported platforms](FAQ.md#what-are-the-supported-platforms).

| Artifact                            | When to choose                    |
| ----------------------------------- | --------------------------------- |
| `marktext-mac-arm64-<version>.dmg`  | Apple Silicon.                    |
| `marktext-mac-x64-<version>.dmg`    | Intel Macs.                       |
| `marktext-mac-<arch>-<version>.zip` | Plain zip alternative to the DMG. |

Open the DMG and drag MarkText into your **Applications** folder. The packaging configuration sets `mac.notarize: false`, so macOS may block the first launch. If macOS blocks the app, review the system's security prompt before proceeding.

## Linux

MarkText ships x64 packages in five Linux formats. Since 0.23.0, arm64 packages are also available as AppImage, deb, rpm and tar.gz, named `marktext-linux-arm64-<version>.<ext>`. Snap is built for x64 only. Most users want the AppImage.

| Artifact                            | When to choose                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `marktext-linux-<version>.AppImage` | Standalone executable. Requires compatible system libraries. `chmod +x` and double-click (or run directly). |
| `marktext-linux-<version>.deb`      | Debian, Ubuntu, Linux Mint, Pop!_OS, … (`sudo apt install ./marktext-linux-<version>.deb`).                 |
| `marktext-linux-<version>.rpm`      | Fedora, RHEL, openSUSE, … (`sudo rpm -i marktext-linux-<version>.rpm`).                                     |
| `marktext-linux-<version>.snap`     | Ubuntu / any snap-enabled distro (`sudo snap install marktext-linux-<version>.snap --dangerous`).           |
| `marktext-linux-<version>.tar.gz`   | Portable tarball. Extract and run the included `marktext` binary.                                           |

> [!NOTE]
> See [Linux notes](LINUX.md) for distro-specific tips (sandbox flags, font configuration, file-association quirks).

## Verify the download

All artifacts are listed with their SHA-256 in `SHA256SUMS.txt`. Verify with:

```sh
# Linux with GNU coreutils
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On macOS, use `shasum -a 256 <downloaded-file>` and compare its output with the matching entry in `SHA256SUMS.txt`.

## Build from source

If you'd rather build from source — for example to track `develop`, to run on an architecture we don't publish a binary for, or to contribute — see the [Build instructions](../dev/BUILD.md) in the developer docs. A minimal recap:

```sh
git clone https://github.com/marktext/marktext.git
cd marktext
pnpm install
pnpm run build:linux:x64
```

This example packages Linux x64. On another host or architecture, choose the matching `build:win:x64`, `build:win:arm64`, `build:mac:x64`, `build:mac:arm64` or `build:linux:arm64` script. Installers land in the repository's `dist/` folder; `pnpm run build` alone only compiles the application.

## Updating

Use the application's **Check for Updates** action to look for an update. If one is available, MarkText asks whether to download and install it. Downloading starts after confirmation; once it finishes, the application quits to install the update. Save your work before accepting.

You can also download a newer package from the releases page and install or extract it using the instructions above.

## Uninstall

| Platform                  | How                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Windows                   | **Settings → Apps**, or run the bundled `Uninstall MarkText.exe`.                                    |
| macOS                     | Drag **MarkText.app** to the Trash. Optionally also remove `~/Library/Application Support/marktext`. |
| Linux (.deb)              | `sudo apt remove marktext`                                                                           |
| Linux (.rpm)              | `sudo rpm -e marktext`                                                                               |
| Linux (snap)              | `sudo snap remove marktext`                                                                          |
| Linux (AppImage / tar.gz) | Delete the file you extracted.                                                                       |

To wipe MarkText's user data as well, remove its [application data directory](APPLICATION_DATA_DIRECTORY.md).
