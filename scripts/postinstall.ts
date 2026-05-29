#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
/**
 * Cross-platform postinstall: patch native-keymap for C++20, download Electron,
 * rebuild all native modules for Electron's ABI, generate locale files.
 *
 * native-keymap is listed as optionalDependency so pnpm ignores its auto-gyp
 * compile failure on Node v24+. This script restores the source, patches and
 * rebuilds it correctly via @electron/rebuild.
 *
 * Step order matters: native-keymap source must be restored before downloading
 * Electron, because the inner `pnpm add` can disturb devDependency state.
 *
 * Monorepo layout: the Electron desktop app lives in packages/desktop with
 * its own node_modules (workspace-local deps are not hoisted to the root —
 * `shamefully-hoist=true` only flattens transitive deps). All Electron-related
 * lookups (binary, install.js, native-keymap, electron-rebuild, patch-package)
 * therefore resolve under packages/desktop/node_modules. patch-package and
 * electron-rebuild also run with cwd=packages/desktop so that `patches/` and
 * the local package.json are picked up correctly.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const repoRoot = path.join(__dirname, '..')
const desktopRoot = path.join(repoRoot, 'packages', 'desktop')

function run(cmd, opts = {}) {
  const { cwd = repoRoot, env = {} } = opts
  execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, ...env } })
}

// Detect which package manager invoked this postinstall so commands work
// regardless of whether the caller is pnpm (primary) or npm (fallback).
const userAgent = process.env.npm_config_user_agent || ''
const isPnpm = userAgent.startsWith('pnpm')
// patch-package and electron-rebuild are locally installed; call their
// node_modules/.bin entries directly (hoisted by shamefully-hoist=true).
const ext = process.platform === 'win32' ? '.cmd' : ''
const patchPackageBin = path.join(desktopRoot, 'node_modules', '.bin', `patch-package${ext}`)
const electronRebuildBin = path.join(desktopRoot, 'node_modules', '.bin', `electron-rebuild${ext}`)

// ── 1. Ensure native-keymap source is present (pm removes it on optional failure) ──
const nativeKeymapDir = path.join(desktopRoot, 'node_modules', 'native-keymap')
if (!fs.existsSync(nativeKeymapDir)) {
  console.log('Installing native-keymap source (skipping compilation)...')
  // native-keymap is already in marktext's optionalDependencies; the add
  // re-installs without changing the version range.
  if (isPnpm) {
    run('pnpm --filter marktext add native-keymap --ignore-scripts')
  } else {
    run('npm install native-keymap --ignore-scripts --no-save', { cwd: desktopRoot })
  }
}

// ── 2. Download + extract Electron binary ────────────────────────────────────
const electronInstall = path.join(desktopRoot, 'node_modules', 'electron', 'install.js')

if (!fs.existsSync(electronInstall)) {
  console.error('electron/install.js not found — skipping Electron download')
} else {
  const os = require('os')
  const plat =
    process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || os.platform()
  const platformBinary =
    plat === 'win32'
      ? 'electron.exe'
      : plat === 'darwin' || plat === 'mas'
        ? 'Electron.app/Contents/MacOS/Electron'
        : 'electron'

  const pathTxt = path.join(desktopRoot, 'node_modules', 'electron', 'path.txt')
  const distDir = path.join(desktopRoot, 'node_modules', 'electron', 'dist')

  // On macOS we also require Frameworks/ — yauzl v2.10.0 hangs on Node v26+ and
  // silently produces an incomplete dist/ without Frameworks.
  const isComplete = () => {
    if (!fs.existsSync(pathTxt)) return false
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    if (!fs.existsSync(path.join(desktopRoot, 'node_modules', 'electron', rel))) return false
    if (plat === 'darwin' || plat === 'mas') {
      return fs.existsSync(path.join(distDir, 'Electron.app', 'Contents', 'Frameworks'))
    }
    return true
  }

  if (!isComplete()) {
    // Remove any partial dist so install.js always runs extraction fresh
    if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true })
    if (fs.existsSync(pathTxt)) fs.unlinkSync(pathTxt)

    console.log('Downloading Electron binary...')
    try {
      run(`node "${electronInstall}"`)
    } catch {
      const mirror = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
      console.log(`Direct download failed, retrying with mirror: ${mirror}`)
      run(`node "${electronInstall}"`, { env: { ELECTRON_MIRROR: mirror } })
    }

    // yauzl v2.10.0 + Node v26+: openReadStream callback never fires for
    // compressed entries → extract-zip exits silently with incomplete dist/.
    // Re-extract using system unzip which handles the zip correctly.
    if (
      (plat === 'darwin' || plat === 'mas') &&
      !fs.existsSync(path.join(distDir, 'Electron.app', 'Contents', 'Frameworks'))
    ) {
      const { version } = require(path.join(desktopRoot, 'node_modules', 'electron', 'package.json'))
      const arch = process.env.npm_config_arch || os.arch()
      const zipName = `electron-v${version}-darwin-${arch === 'arm64' ? 'arm64' : 'x64'}.zip`
      const cacheRoot =
        process.env.electron_config_cache ||
        path.join(os.homedir(), 'Library', 'Caches', 'electron')

      let zipPath = ''
      try {
        zipPath = execSync(`find "${cacheRoot}" -name "${zipName}" 2>/dev/null | head -1`)
          .toString()
          .trim()
      } catch {
        /* ignore */
      }

      if (!zipPath) {
        throw new Error(
          'Electron zip not in cache after download. ' +
            'Try: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install'
        )
      }

      console.log(
        `Re-extracting with system unzip (yauzl incompatible with Node ${process.version})...`
      )
      if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true })
      run(`unzip -q "${zipPath}" -d "${distDir}"`)
      fs.writeFileSync(pathTxt, platformBinary)
      fs.writeFileSync(path.join(distDir, 'version'), version)
    }

    // Ensure path.txt exists (install.js may skip it on a cache hit)
    if (!fs.existsSync(pathTxt)) {
      fs.writeFileSync(pathTxt, platformBinary)
    }
  }
}

// ── 3. Apply C++20 patch to native-keymap (patches/ lives in packages/desktop) ──
console.log('Applying patches...')
run(`"${patchPackageBin}"`, { cwd: desktopRoot })

// ── 4. Rebuild native modules for Electron ABI ──────────────────────────────
console.log('Rebuilding native modules for Electron...')
run(`"${electronRebuildBin}" -f`, { cwd: desktopRoot })

// ── 5. Generate minified locale files ───────────────────────────────────────
console.log('Minifying locales...')
run('pnpm tsx scripts/minify-locales.ts')
