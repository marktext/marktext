# Build Instructions

Clone the repository:

```
git clone https://github.com/marktext/marktext.git
```

### Prerequisites

Before you can get started developing, you need set up your build environment:

- Node.js `>=v12.0.0`, npm and yarn
- Python `v2.7.x` for node-gyp
- C++ compiler and development tools

**Additional development dependencies on Linux:**

- libx11 (dev)
- libxkbfile (dev)
- libsecret (dev)
- libfontconfig (dev)

On Debian-based Linux: `sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev`

On Red Hat-based Linux: `sudo dnf install libx11-devel libxkbfile-devel libsecret-devel fontconfig-devel`

### Let's build

1. Go to `marktext` folder
2. Install dependencies: `yarn install` or `yarn install --frozen-lockfile`
3. Build Mark Text binaries and packages: `yarn run build`
4. Mark Text binary is located under `build` folder

Copy the build app to applications folder, or if on Windows run the executable installer.

### Important scripts

```
$ yarn run <script> # or npm run <script>
```

| Script          | Description                                       |
| --------------- | ------------------------------------------------- |
| `build`         | Build Mark Text binaries and packages for your OS |
| `build:bin`     | Build Mark Text binary for your OS                |
| `dev`           | Build and run Mark Text in developer mode         |
| `lint`          | Lint code style                                   |
| `test` / `unit` | Run unit tests                                    |

For more scripts please see `package.json`.
