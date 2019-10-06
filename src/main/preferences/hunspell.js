import path from 'path'
import fs from 'fs-extra'

// This is an asynchronous function to not block the process. The spell checker may be
// diabled on first application start because the dictionary doesn't exists or is incomplete.
export default async appDataPath => {
  let srcPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    // Default location: node_modules/electron/dist/resources/
    srcPath = path.join(srcPath, '../../../../resources')
  }
  srcPath = path.join(srcPath, 'hunspell_dictionaries/en-US.bdic')

  // NOTE: Hardcoded in "electron-spellchecker/src/dictionary-sync.js"
  const destDir = path.join(appDataPath, 'dictionaries')
  const destPath = path.join(destDir, 'en-US.bdic')

  if (!await fs.exists(destPath) && await fs.exists(srcPath)) {
    await fs.ensureDir(destDir)
    await fs.copy(srcPath, destPath)
  }
}
