# Build Instructions

**Please see [this issue](https://github.com/jacobwhall/marktext/issues/2) for updates on our efforts to modernize this process!**

Clone the repository:

```
git clone https://github.com/marktext/marktext.git
```

## Container Setup

The Marktext build process currently relies on an old version of node.
The easiest way to build Marktext for Linux right now is from inside a container.
Here are the steps for doing so:
```sh
# cd to marktext repository

# run container (you can use docker instead of podman if you like)
podman run -it -v ./:/mnt:Z node:18.19-bookworm /bin/bash
# you should now be interacting with the container

# install dependency xkbfile
apt update
apt-get install libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev rpm

cd /mnt
yarn install
yarn run build

exit
# container should now be terminated

# build artifacts can be found in build directory
```

Below are the complete build instructions, which may help you troubleshoot the above or attempt to build for other platforms.

### Prerequisites

Before you can get started developing, you need set up your build environment:

- Node.js `>=v16` but `<v17` and yarn
- Python `>=v3.6` for node-gyp
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
- Visual Studio 2019 (preferred)

### Let's build

1. Go to `marktext` folder
2. Install dependencies: `yarn install` or `yarn install --frozen-lockfile`
3. Build MarkText binaries and packages: `yarn run build`
4. MarkText binary is located under `build` folder

Copy the build app to applications folder, or if on Windows run the executable installer.

### Important scripts

```
$ yarn run <script> # or npm run <script>
```

| Script          | Description                                      |
| --------------- | ------------------------------------------------ |
| `build`         | Build MarkText binaries and packages for your OS |
| `build:bin`     | Build MarkText binary for your OS                |
| `dev`           | Build and run MarkText in developer mode         |
| `lint`          | Lint code style                                  |
| `test` / `unit` | Run unit tests                                   |

For more scripts please see `package.json`.

>[!TIP]
>To improve efficiency during development, you can tr
> 1. Use `yarn dev` instead of `yarn build:bin`. This will automatically reload the window when source code is modified.
> 2. Use `Ctrl+R` to manually reload the application in development mode if needed.
> 
> This approach bypasses unnecessary rebuilds and optimizes the developer workflow. However, for CI or release builds, a full rebuild may still be necessary.
