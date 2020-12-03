import path from 'path'
// import { rgPath } from 'vscode-ripgrep'
import EnvPaths from 'common/envPaths'
import { getResourcesPath } from 'common/filesystem/paths'

// WORKAROUND: We are unable to load vscode-ripgrep when it's bundled into the asar since Electron 11 (electron-builder#5360).
let rgDiskPath
if (process.env.NODE_ENV === 'development') {
  rgDiskPath = require('vscode-ripgrep').rgPath
} else {
  rgDiskPath = path.join(getResourcesPath(), `app.asar.unpacked/node_modules/vscode-ripgrep/bin/rg${process.platform === 'win32' ? '.exe' : ''}`)
}
// END WORKAROUND

// // // "vscode-ripgrep" is unpacked out of asar because of the binary.
// const rgDiskPath = rgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')

class RendererPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param {string} userDataPath The user data path.
   */
  constructor (userDataPath) {
    if (!userDataPath) {
      throw new Error('No user data path is given.')
    }

    // Initialize environment paths
    super(userDataPath)

    // Allow to use a local ripgrep binary (e.g. an optimized version).
    if (process.env.MARKTEXT_RIPGREP_PATH) {
      // NOTE: Binary must be a compatible version, otherwise the searcher may fail.
      this._ripgrepBinaryPath = process.env.MARKTEXT_RIPGREP_PATH
    } else {
      this._ripgrepBinaryPath = rgDiskPath
    }
  }

  // Returns the path to ripgrep on disk.
  get ripgrepBinaryPath () {
    return this._ripgrepBinaryPath
  }
}

export default RendererPaths
