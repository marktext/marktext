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

// WORKAROUND: Ad-hoc sign app-builder-bin macOS binaries to prevent false positive virus scanner
//   detections (OSX/AdLoad). The upstream package ships unsigned Mach-O binaries.
if (process.platform === 'darwin') {
  const { execSync } = require('child_process')
  const appBuilderMacDir = path.resolve(__dirname, '../node_modules/app-builder-bin/mac')
  if (fs.existsSync(appBuilderMacDir)) {
    for (const file of fs.readdirSync(appBuilderMacDir)) {
      const binPath = path.join(appBuilderMacDir, file)
      try {
        execSync(`codesign --sign - --force "${binPath}"`, { stdio: 'pipe' })
      } catch (e) {
        console.warn(`[WARN] Failed to ad-hoc sign ${file}: ${e.message}`)
      }
    }
  }
}

// WORKAROUND: electron-builder downloads the wrong prebuilt architecture on macOS and the reason is unknown.
//   For now, we rebuild all native libraries from source.
const keytarPath = path.resolve(__dirname, '../node_modules/keytar')
if (process.platform === 'darwin' && fs.existsSync(keytarPath)) {
  const keytarPackageJsonPath = path.join(keytarPath, 'package.json')
  let packageText = fs.readFileSync(keytarPackageJsonPath, { encoding : 'utf-8' })

  packageText = packageText.replace(/"install": "prebuild-install \|\| npm run build",/i, '"install": "npm run build",')
  fs.writeFileSync(keytarPackageJsonPath, packageText, { encoding : 'utf-8' })
}
