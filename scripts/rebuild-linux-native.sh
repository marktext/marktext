#!/usr/bin/env bash
#
# Rebuild MarkText's native addons inside an AlmaLinux 8 container.
#
# Electron's own Linux binary only needs glibc 2.25, but the addons (ced,
# keytar, native-keymap) are compiled by @electron/rebuild with whatever
# toolchain the build host provides. On Ubuntu 22.04/24.04 that means
# references to GLIBCXX_3.4.29+ and, for native-keymap, glibc 2.34 pthread
# symbols. Enterprise distros such as Kylin V10 SP1 ship glibc 2.28 /
# libstdc++ 3.4.25 and cannot load such addons.
#
# Building against AlmaLinux 8 caps the glibc floor at 2.28, and
# -static-libstdc++/-static-libgcc removes the libstdc++ dependency from the
# addons compiled from source, so the host's libstdc++ version no longer
# matters for them. keytar is not compiled here: @electron/rebuild takes its
# prebuilt N-API binary, which needs only GLIBCXX 3.4.21 and glibc 2.17.
#
# Run after postinstall (node_modules and Electron must be in place). The
# rebuilt files are left owned by the invoking user, so the `electron-rebuild`
# inside the build:linux scripts treats them as up to date and does not
# recompile them with the host toolchain.
#
# Requires Docker and a Linux host; the image architecture follows the host.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
desktop_dir="$repo_root/packages/desktop"
build_image="${MARKTEXT_BUILD_IMAGE:-almalinux:8}"
node_version="${MARKTEXT_BUILD_NODE_VERSION:-24.14.1}"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is required to rebuild the Linux native addons" >&2
  exit 1
fi

if [[ ! -f "$desktop_dir/node_modules/electron/package.json" ]]; then
  echo "error: $desktop_dir/node_modules/electron is missing; run pnpm install first" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64 | amd64) node_arch=x64 ;;
  aarch64 | arm64) node_arch=arm64 ;;
  *)
    echo "error: unsupported host architecture $(uname -m)" >&2
    exit 1
    ;;
esac

# The container's glibc (2.28) predates most distribution Node packages, so
# use the official build. It is linked against glibc 2.28 / libstdc++ 3.4.21.
# The explicit template honors TMPDIR on macOS, where Docker only shares
# selected host directories with the VM.
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/marktext-native-build.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

echo "Downloading Node.js v$node_version ($node_arch) for the build container..."
curl -fsSL --retry 3 \
  "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-${node_arch}.tar.gz" \
  -o "$work_dir/node.tar.gz"
tar -xzf "$work_dir/node.tar.gz" -C "$work_dir"

docker run --rm --interactive \
  --volume "$repo_root:/repo" \
  --volume "$work_dir/node-v${node_version}-linux-${node_arch}:/node:ro" \
  --env HOST_UID="$(id -u)" \
  --env HOST_GID="$(id -g)" \
  "$build_image" \
  bash -s <<'CONTAINER_SCRIPT'
set -euo pipefail

export PATH="/node/bin:/opt/rh/gcc-toolset-13/root/usr/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export CC=gcc CXX=g++ PYTHON=/usr/bin/python3.11
export LDFLAGS="-static-libstdc++ -static-libgcc"

# libxkbfile-devel is not in AppStream on AlmaLinux 8.
available_repos=$(dnf repolist --all 2>/dev/null || true)
extra_repos=()
if grep -q '^powertools' <<<"$available_repos"; then
  extra_repos=(--enablerepo=powertools)
fi

# gcc-toolset-13 because native-keymap needs C++20; the base gcc is 8.x.
dnf -y install "${extra_repos[@]}" \
  gcc-toolset-13-gcc-c++ gcc-toolset-13-libstdc++-devel \
  make python3.11 pkgconf-pkg-config \
  libX11-devel libxkbfile-devel libsecret-devel

echo "--- build toolchain ---"
node --version
gcc --version | head -n1
g++ --version | head -n1

# Everything the build touches is written as root, so re-own it afterwards for
# the build host. The marker is backdated because mtimes and the marker can
# collide within the same second.
marker=/tmp/build-start
touch -d '2 seconds ago' "$marker"

cd /repo/packages/desktop
./node_modules/.bin/electron-rebuild -f

# Modules built from source land in the pnpm store at the workspace root, while
# prebuilt modules (keytar) are installed into the package's own node_modules,
# so both trees have to be re-owned. Prebuilt binaries keep the timestamp from
# their release archive and are therefore matched by name rather than mtime.
for dir in /repo/node_modules /repo/packages/desktop/node_modules; do
  [[ -d "$dir" ]] || continue
  find "$dir" \( -newer "$marker" -o -name '*.node' -o -name '.forge-meta' \) \
    -exec chown -h "$HOST_UID:$HOST_GID" {} +
done
CONTAINER_SCRIPT

echo "Linux native addons rebuilt against glibc 2.28."
