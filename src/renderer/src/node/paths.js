import EnvPaths from 'common/envPaths'

const env = (window.electron && window.electron.process && window.electron.process.env) || {}
const exposedPaths = (window.electron && window.electron.paths) || {}

// Allow a local override (e.g. an optimized ripgrep build). Otherwise use the
// asar-unpacked path resolved by the main process and forwarded via boot info.
const ripgrepBinaryPath = env.MARKTEXT_RIPGREP_PATH || exposedPaths.ripgrepBinary || ''

class RendererPaths extends EnvPaths {
  /**
   * @param {string} userDataPath The user data path.
   */
  constructor(userDataPath) {
    if (!userDataPath) {
      throw new Error('No user data path is given.')
    }
    super(userDataPath)
    this._ripgrepBinaryPath = ripgrepBinaryPath
  }

  get ripgrepBinaryPath() {
    return this._ripgrepBinaryPath
  }
}

export default RendererPaths
