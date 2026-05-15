#!/usr/bin/env node
/**
 * Cross-platform postinstall: patch native-keymap for C++20, download Electron,
 * rebuild all native modules for Electron's ABI, generate locale files.
 *
 * native-keymap is listed as optionalDependency so npm ignores its auto-gyp
 * compile failure on Node v24+. This script restores the source, patches and
 * rebuilds it correctly via @electron/rebuild.
 *
 * Step order matters: native-keymap source must be restored before downloading
 * Electron, because the inner `npm install` can disturb devDependency state.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')

function run(cmd, env = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } })
}

// ── 1. Ensure native-keymap source is present (npm removes it on optional failure) ──
const nativeKeymapDir = path.join(root, 'node_modules', 'native-keymap')
if (!fs.existsSync(nativeKeymapDir)) {
  console.log('Installing native-keymap source (skipping compilation)...')
  // Keep --no-save so package.json is untouched; do NOT pass --no-package-lock
  // so npm reads the lockfile and avoids broad tree mutations.
  run('npm install native-keymap --ignore-scripts --no-save')
}

// ── 2. Download Electron binary ──────────────────────────────────────────────
const electronInstall = path.join(root, 'node_modules', 'electron', 'install.js')

if (!fs.existsSync(electronInstall)) {
  console.error('electron/install.js not found — skipping Electron download')
} else {
  const pathTxt = path.join(root, 'node_modules', 'electron', 'path.txt')
  const isDownloaded = () => {
    if (!fs.existsSync(pathTxt)) return false
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    return fs.existsSync(path.join(root, 'node_modules', 'electron', rel))
  }

  if (!isDownloaded()) {
    console.log('Downloading Electron binary...')
    try {
      run(`node "${electronInstall}"`)
    } catch {
      const mirror = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
      console.log(`Direct download failed, retrying with mirror: ${mirror}`)
      run(`node "${electronInstall}"`, { ELECTRON_MIRROR: mirror })
    }
  }

  // install.js can skip writing path.txt when the zip is already cached.
  // Write it ourselves so electron-vite can locate the binary for `npm run dev`.
  if (!fs.existsSync(pathTxt)) {
    const os = require('os')
    const plat = process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || os.platform()
    const platformBinary =
      plat === 'win32' ? 'electron.exe' :
      plat === 'darwin' || plat === 'mas' ? 'Electron.app/Contents/MacOS/Electron' :
      'electron'
    fs.writeFileSync(pathTxt, platformBinary)
  }
}

// ── 3. Apply C++20 patch to native-keymap ───────────────────────────────────
console.log('Applying patches...')
run('npx patch-package')

// ── 4. Rebuild native modules for Electron ABI ──────────────────────────────
console.log('Rebuilding native modules for Electron...')
run('npx @electron/rebuild -f')

// ── 5. Generate minified locale files ───────────────────────────────────────
console.log('Minifying locales...')
run('npm run minify-locales')
