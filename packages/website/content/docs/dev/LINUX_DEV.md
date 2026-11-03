# Linux Development

Use Node.js `>=22.12.0` and pnpm `>=10`, with the pnpm version pinned in the root
`package.json`. Run workspace commands from the repository root. See
[Build instructions](BUILD.md) for the complete install and packaging workflow.

## Build dependencies

Native dependencies need Python 3 and a C++ toolchain as well as X11, keyboard,
keyring and font configuration headers. On Debian/Ubuntu:

```sh
sudo apt-get update
sudo apt-get install -y git python3 build-essential libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev rpm
```

The Linux packaging CI also installs `icnsutils`, `graphicsmagick`, `xz-utils`
and `gnome-keyring`. See `.github/workflows/build.yml` and `release.yml` for the
runner setup. Other distributions' library packages are listed in
[Build instructions](BUILD.md#linux).

## Native-module build failures

Check the first compiler or node-gyp error. Missing X11 or `XKBlib.h` headers
usually indicate that `libx11-dev` is missing; missing `XKBfile.h` indicates
`libxkbfile-dev`. Keytar requires `libsecret-1-dev`. Install the missing build
dependency and rerun `pnpm install`.

After changing Electron, run `pnpm run rebuild-native` to rebuild native modules
against its ABI.

## Missing runtime libraries

A message such as `libglib-2.0.so.0: cannot open shared object file` identifies a
runtime dependency, separate from the build headers. Check the executable's
missing libraries:

```sh
ldd packages/desktop/node_modules/electron/dist/electron
```

Install the distribution package providing each library reported as `not found`.
Debian and RPM application packages declare runtime dependencies in
`packages/desktop/electron-builder.yml`; AppImage and tarball users may need to
install compatible libraries separately. Installing `xorg-dev` alone does not
supply every Electron runtime dependency.

## pnpm store permissions

Run installation as your normal user. To locate the store in use:

```sh
pnpm store path
```

If a previous root-owned install caused permission errors, inspect and correct
ownership of that specific store directory. Its location depends on pnpm and
system configuration; do not assume it is always `~/.local/share/pnpm/store`.
