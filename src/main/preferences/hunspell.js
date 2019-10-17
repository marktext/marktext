import path from 'path'
import fs from 'fs-extra'
import { isOsx } from '../config'

// This is an asynchronous function to not block the process. The spell checker may be
// diabled on first application start because the dictionary doesn't exists or is incomplete.
export default async appDataPath => {
  let srcPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    // Default locations:
    //   Linux/Windows: node_modules/electron/dist/resources/
    //   macOS: node_modules/electron/dist/Electron.app/Contents/Resources
    if (isOsx) {
      srcPath = path.join(srcPath, '../..')
    }
    srcPath = path.join(srcPath, '../../../../resources')
  }
  srcPath = path.join(srcPath, 'hunspell_dictionaries/en-US.bdic')

  // NOTE: Hardcoded in "@hfelix/electron-spellchecker/src/spell-check-handler.js"
  const destDir = path.join(appDataPath, 'dictionaries')
  const destPath = path.join(destDir, 'en-US.bdic')

  if (!await fs.exists(destPath) && await fs.exists(srcPath)) {
    await fs.ensureDir(destDir)
    await fs.copy(srcPath, destPath)
  }
}
