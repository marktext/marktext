# Linux installation instructions

## AppImage

Download the AppImage and type the following:

1. `chmod +x marktext-%version%-x86_64.AppImage`
2. `./marktext-%version%-x86_64.AppImage`
3. Now you can decide whether you want to install Mark Text (yes) or just execute it (no).

### Installation

You cannot really install a AppImage. It's just a file which can be integrated with your desktop environment. The only thing you have to do is to execute Mark Text and click `Yes` on dialog.

### Uninstall

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

### Extract application (not recommended)

1. `./marktext-%version%-x86_64.AppImage --appimage-extract`
2. Move Mark Text into another location: `mkdir ~/bin/marktext && mv squashfs-root/app/* ~/bin/marktext`
3. Delete `squashfs-root` folder

### Known issues

- Mark Text is always integrated into desktop environment after updating

## Snappy

Download snap file and execute `sudo snap install --classic --dangerous marktext_%version%_amd64.snap`.

Please note that snappy packages may not work on not Debian-based distros and SELinux distros.

### Known issues

- Library problems on SELinux distros (even if SELinux is disabled) and not Debian-based distros.
- User directories (like documents and downloads) are always saved under the english name.
