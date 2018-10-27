# Linux installation instructions

## AppImage

Download the AppImage and type the following:

1. `chmod +x marktext-%version%-x86_64.AppImage`
2. `./marktext-%version%-x86_64.AppImage`
3. Now you can decide whether you want to install Mark Text (yes) or just execute it (no).

### Installation

You cannot really install an AppImage. It's just a file which can be integrated with your desktop environment. The only thing you have to do is to execute Mark Text and click `Yes` on dialog.

### Uninstallation

1. Delete AppImage file
2. Delete `~/.local/share/applications/appimagekit-marktext.desktop`
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

- Mark Text is always integrated into desktop environment after updating

## Binary

You can download the latest `marktext-%version%.tar.gz` package from the [release page](https://github.com/marktext/marktext/releases/latest). You may need to install electron dependencies.

## Flatpak

### Installation

**Prerequisites:**

You need to install the `flatpak` package for your distribution. Please see the [official flatpak tutorial](https://flatpak.org/setup/) for more information and note that you have to add the flathub repository (`flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`) as described in the Quick Setup.

**Install from Flathub:**

After you install flatpak and flathub repository, you can install [Mark Text](https://flathub.org/apps/details/com.github.marktext.marktext) with just one command:

```
sudo flatpak install flathub com.github.marktext.marktext
```

or `flatpak install --user flathub com.github.marktext.marktext` to install for the current user only.

To run Mark Text just execute `flatpak run com.github.marktext.marktext` or click on the Mark Text icon in your application launcher.

### Update

To update Mark Text run the following command:

```
sudo flatpak update com.github.marktext.marktext
```

or `sudo flatpak update` to update all installed flatpaks.
