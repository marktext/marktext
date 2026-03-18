'use strict'

/**
 * Rebuild native modules for the current Electron version.
 * Uses the @electron/rebuild API directly (not the CLI) to avoid
 * yargs ESM compatibility issues with Node.js 22.
 *
 * Fails gracefully — a rebuild failure should not block yarn install.
 * Native modules will still work if pre-built binaries match the platform.
 */

const path = require('path')
const fs = require('fs')

const rootDir = path.resolve(__dirname, '..')

async function main () {
  // Check if electron is installed
  const electronPkgPath = path.join(rootDir, 'node_modules', 'electron', 'package.json')
  if (!fs.existsSync(electronPkgPath)) {
    console.log('[rebuild] Electron not installed yet, skipping rebuild.')
    return
  }

  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf-8'))
  const electronVersion = electronPkg.version
  console.log(`[rebuild] Rebuilding native modules for Electron ${electronVersion}...`)

  try {
    const { rebuild } = require('@electron/rebuild')
    await rebuild({
      buildPath: rootDir,
      electronVersion,
      force: true
    })
    console.log('[rebuild] Native modules rebuilt successfully.')
  } catch (err) {
    console.warn(`[rebuild] WARNING: Native module rebuild failed: ${err.message}`)
    console.warn('[rebuild] The app may still work if pre-built binaries are available.')
    console.warn('[rebuild] To rebuild manually: node -e "require(\'@electron/rebuild\').rebuild({buildPath:\'.\',electronVersion:require(\'./node_modules/electron/package.json\').version,force:true})"')
    // Don't exit with error — let install continue
  }
}

main()
