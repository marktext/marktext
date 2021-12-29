'use strict'
const fs = require('fs')
const path = require('path')

// WORKAROUND: Fix slow startup time on Windows due to blocking powershell call(s) in windows-release.
//   Replace the problematic file with our "fixed" version.
const windowsReleasePath = path.resolve(__dirname, '../node_modules/windows-release')
if (fs.existsSync(windowsReleasePath)) {
  const windowsReleaseJson = path.join(windowsReleasePath, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(windowsReleaseJson, { encoding : 'utf-8' }))

  const windowsReleaseMajor = Number(packageJson.version.match(/^(\d+)\./)[1])
  if (windowsReleaseMajor >= 5) {
    console.error('[ERROR] "windows-release" workaround failed because version is >=5.\n')
    process.exit(1)
  }

  const srcPath = path.resolve(__dirname, '../resources/build/windows-release.js')
  const destPath = path.join(windowsReleasePath, 'index.js')
  fs.copyFileSync(srcPath, destPath)
}
