#!/usr/bin/env bash
#
# Verify that the native addons shipped in the Linux packages stay loadable on
# the oldest distributions MarkText supports: glibc 2.28 / libstdc++ 3.4.25
# (RHEL 8 era, e.g. Kylin V10, UOS V20, Debian 10).
#
# Electron's own Linux binary needs only glibc 2.25, so the addons are the
# packaged objects that can raise the symbol floor. The check runs on the
# unpacked app that electron-builder produced rather than on node_modules, so
# it also proves the rebuilt addons actually made it into the package.
#
# Both static and dynamically linked libstdc++ are accepted; only the symbol
# versions decide compatibility, and a prebuilt addon can be fine while linking
# libstdc++ dynamically (keytar ships a prebuilt N-API binary).

set -euo pipefail

max_glibc="${MARKTEXT_MAX_GLIBC:-2.28}"
max_glibcxx="${MARKTEXT_MAX_GLIBCXX:-3.4.25}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
search_root="${1:-$repo_root/dist}"

if ! command -v readelf >/dev/null 2>&1; then
  echo "error: readelf (binutils) is required" >&2
  exit 1
fi

if [[ ! -d "$search_root" ]]; then
  echo "error: $search_root not found; build the Linux packages first" >&2
  exit 1
fi

addons=()
while IFS= read -r addon; do
  addons+=("$addon")
done < <(find "$search_root" -type f -name '*.node' | LC_ALL=C sort)

if [[ ${#addons[@]} -eq 0 ]]; then
  echo "error: no native addons found under $search_root; build the Linux packages first" >&2
  exit 1
fi

# Highest versioned dependency of the given prefix (GLIBC -> 2.34). Prints
# nothing when the file has no versioned dependency on that prefix.
max_version() {
  local prefix="$1" file="$2" found
  found=$(readelf --version-info "$file" 2>/dev/null |
    grep -oE "${prefix}_[0-9]+(\.[0-9]+)*" |
    sed "s/^${prefix}_//" || true)
  if [[ -z "$found" ]]; then
    return 0
  fi
  sort -V <<<"$found" | tail -n 1
}

version_le() {
  [[ "$1" == "$2" || "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n 1)" == "$1" ]]
}

failures=0

for addon in "${addons[@]}"; do
  problems=()
  if [[ -z "$(readelf -d "$addon" 2>/dev/null || true)" ]]; then
    problems+=("not a readable ELF object")
  fi

  glibc_max=$(max_version GLIBC "$addon")
  if [[ -z "$glibc_max" ]]; then
    problems+=("no GLIBC symbol versions found")
  elif ! version_le "$glibc_max" "$max_glibc"; then
    problems+=("needs GLIBC_$glibc_max, limit is GLIBC_$max_glibc")
  fi

  glibcxx_max=$(max_version GLIBCXX "$addon")
  if [[ -n "$glibcxx_max" ]] && ! version_le "$glibcxx_max" "$max_glibcxx"; then
    problems+=("needs GLIBCXX_$glibcxx_max, limit is GLIBCXX_$max_glibcxx")
  fi

  display="${addon#"$search_root"/}"
  if [[ ${#problems[@]} -eq 0 ]]; then
    printf 'ok    %s (GLIBC_%s, GLIBCXX_%s)\n' "$display" "${glibc_max:-none}" "${glibcxx_max:-none}"
  else
    failures=$((failures + 1))
    printf 'FAIL  %s\n' "$display"
    printf '        %s\n' "${problems[@]}"
  fi
done

if [[ $failures -gt 0 ]]; then
  echo "error: $failures native addon(s) exceed the glibc $max_glibc / libstdc++ $max_glibcxx baseline" >&2
  exit 1
fi

echo "All ${#addons[@]} native addons fit the glibc $max_glibc / libstdc++ $max_glibcxx baseline."
