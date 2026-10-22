# Linux Installation Instructions

## AppImage

[Download the AppImage](https://github.com/marktext/marktext/releases/latest) and type the following:

1. `chmod +x marktext-%version%-x86_64.AppImage`
2. `./marktext-%version%-x86_64.AppImage`
3. Now you can execute MarkText.

### Installation

You cannot really install an AppImage. It's a file which can run directly after getting executable permission. To integrate it into desktop environment, you can either create desktop entry manually **or** use [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

#### Desktop file creation

See [example desktop file](https://github.com/marktext/marktext/blob/develop/resources/linux/marktext.desktop).

```bash
$ curl -L https://raw.githubusercontent.com/marktext/marktext/develop/resources/linux/marktext.desktop -o $HOME/.local/share/applications/marktext.desktop

# Update the Exec in desktop file to your real marktext command. Specify Path if necessary.
$ vim $HOME/.local/share/applications/marktext.desktop

$ update-desktop-database $HOME/.local/share/applications/
```

#### AppImageLauncher integration

You can integrate the AppImage into the system via [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher). It will handle the desktop entry automatically.

### Uninstallation

1. Delete AppImage file.
2. Delete your desktop file if exists.
3. Delete your user settings: `~/.config/marktext`

### Custom launch script

1. Save AppImage somewhere. Let's say `~/bin/marktext.AppImage`
2. `chmod +x ~/bin/marktext.AppImage`
3. Create a launch script:

   ```sh
   #!/bin/bash
   DESKTOPINTEGRATION=0 ~/bin/marktext.AppImage
   ```

### Known issues

- MarkText is always integrated into desktop environment after updating

## Binary

You can download the latest `marktext-%version%.tar.gz` package from the [release page](https://github.com/marktext/marktext/releases/latest). You may need to install electron dependencies.

## Homebrew on Linux

The Homebrew cask command shown in the macOS installation instructions is macOS-only:

```bash
brew install --cask mark-text
```

It installs the existing `mark-text` cask for macOS application bundles and is separate from Homebrew on Linux.

Linux Homebrew support is being prepared as an experimental formula for a future custom tap. Until maintainers publish a tap, there is no official `brew install marktext` path for Linux. The draft formula template lives at [`packaging/homebrew/marktext.rb`](https://github.com/marktext/marktext/blob/develop/packaging/homebrew/marktext.rb) and is intended to install the Linux `tar.gz` release artifact after a new tagged release is available.

Maintainers testing a future release can update the template URL and SHA256, then run:

```bash
brew style packaging/homebrew/marktext.rb
brew audit --strict --online <tap>/marktext
brew install <tap>/marktext
```

Source builds from `develop` are not recommended as the default Homebrew path because they require a full pnpm/Electron build and network downloads during installation.

## Arch User Repository

MarkText is available on the AUR as `marktext-bin` and will automatically install the dependencies: `glibc`, `gtk3`, `nss`, `alsa-lib`, `libxss`, `cups`, `libxkbcommon`, `libxkbfile`, `mesa`, and `hicolor-icon-theme`.

Install it via an AUR helper like `yay -S marktext-bin` or with

```bash
git clone https://aur.archlinux.org/marktext.git
cd marktext-bin
makepkg -si
```

Note: The AUR package is not maintained by the maintainer of this repository and may be out of date. Take note of the version numbers and modify the PKGBUILD on the AUR as necessary before installation or update.
