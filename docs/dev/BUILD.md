# Build Instructions

**Please see [this issue](https://github.com/jacobwhall/marktext/issues/2) for updates on our efforts to modernize this process!**

Clone the repository:

```
git clone https://github.com/marktext/marktext.git
```

## Container Setup

The easiest way to build Marktext on Linux is from inside a container.
Here are the steps for doing so:
```sh
# cd to marktext repository

# run container (you can use docker instead of podman if you like)
podman run -it -v ./:/mnt:Z node:22-bookworm /bin/bash
# you should now be interacting with the container

# add bookworm-backports for Python 3.12 and install build dependencies
echo "deb http://deb.debian.org/debian bookworm-backports main" >> /etc/apt/sources.list
apt update
apt-get install -y -t bookworm-backports python3.12
apt-get install -y libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev rpm

cd /mnt
corepack enable
pnpm install
pnpm run build

exit
# container should now be terminated

# build artifacts can be found in the dist/ directory (electron-builder output);
# the intermediate electron-vite bundles live in out/
```

Below are the complete build instructions, which may help you troubleshoot the above or attempt to build for other platforms.

### Prerequisites

Before you can get started developing, you need set up your build environment:

- Node.js `>=20.19.0` and pnpm `>=10`
- Python `>=3.12` for node-gyp
- C++ compiler and development tools
- Build is supported on Linux, macOS and Windows

**Additional development dependencies on Linux:**

- libX11 (with headers)
- libxkbfile (with headers)
- libsecret (with headers)
- libfontconfig (with headers)
- rpm (if building on Debian)

On Debian-based Linux: `sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev rpm`

On Red Hat-based Linux: `sudo dnf install libX11-devel libxkbfile-devel libsecret-devel fontconfig-devel`

On Arch Linux: `sudo pacman -S libx11 libxkbfile libsecret fontconfig`

**Additional development dependencies on Windows:**

- Windows 10 SDK (only needed before Windows 10)
- Visual Studio 2022 (Build Tools for Visual Studio 2022). You also need the spectre-mitigated MSVC libs — see [developer README §1.3](README.md#13-windows-specific-pre-requisites) for the exact components to install.

### Let's build

1. Go to `marktext` folder
2. Install dependencies: `pnpm install`
3. Build MarkText binaries and packages: `pnpm run build`
4. MarkText binary is located under `dist` folder (electron-builder output)

Copy the build app to applications folder, or if on Windows run the executable installer.

### Important scripts

```
$ pnpm run <script>
```

| Script  | Description                                      |
| ------- | ------------------------------------------------ |
| `build` | Build MarkText binaries and packages for your OS |
| `dev`   | Build and run MarkText in developer mode         |
| `lint`  | Lint code style                                  |
| `test`  | Run unit tests                                   |

For more scripts please see `package.json`.

>[!TIP]
>To improve efficiency during development:
> 1. Use `pnpm run dev` for development mode. This will automatically reload the window when source code is modified.
> 2. Use `Ctrl+R` to manually reload the application in development mode if needed.
> 
> This approach bypasses unnecessary rebuilds and optimizes the developer workflow. However, for CI or release builds, a full rebuild may still be necessary.
