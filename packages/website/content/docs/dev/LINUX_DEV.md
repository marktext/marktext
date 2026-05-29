# Linux Specific Pre-requisites

- These are tested on Ubuntu 24.04.2 LTS and Ubuntu 22.04 LTS (thanks to "FP Coetzee")

## System Requirements

- Disk space ~1.2G for basic build.
- RAM: Minimum 4GB recommended (for Electron builds)

## Pre-requisites

- 
- Ubuntu Packages: `git`, `build-essential` and `xorg-dev`

### 1. Install System Packages

for ubuntu

```bash
sudo apt update && sudo apt install -y git build-essential xorg-dev
```

for fedora

```bash
sudo dnf install -y xorg-x11-server-devel libxkbfile-devel
```

### 2. Install Node

- I recommend using [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)

## Common Issues & Solutions

### Issue: pnpm install fails with native-keymap error

**Error message:**

```bash
 ERR_PNPM_OPTIONAL_DEPS_REQUIRER  optional dep native-keymap failed
 ...
 node-gyp ERR! build error
 node-gyp ERR! gyp ERR! rebuild
```

**Solution:**
This occurs when `xorg-dev` is missing. Install it:

```bash
sudo apt install xorg-dev
```

Then retry:

```bash
pnpm install
```

### Issue: Electron fails to start with libglib error

**Error message:**

```bash
~/marktext/node_modules/electron/dist/electron: error while loading shared libraries:
libglib-2.0.so.0: cannot open shared object file: No such file or directory
```

**Solution:**
Install the X11/GUI development libraries:

```bash
sudo apt install xorg-dev
```

If the issue persists, you may need the full X11 environment:

```bash
sudo apt install xorg
```

### Issue: Permission errors during pnpm install

**Solution:**
Make sure you're not running `pnpm` commands with `sudo`. pnpm stores packages in a global content-addressable store (default: `~/.local/share/pnpm/store`). If you encounter permission errors, ensure the store directory is owned by your user:

```bash
# Check and fix store ownership if needed
sudo chown -R $(whoami) ~/.local/share/pnpm
```
