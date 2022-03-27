import path from 'path'
import AppPaths, { ensureAppDirectoriesSync } from './paths'

let envId = 0

const patchEnvPath = () => {
  if (process.platform === 'darwin') {
    process.env.PATH += (process.env.PATH.endsWith(path.delimiter) ? '' : path.delimiter) + '/Library/TeX/texbin'
  }
}

export class AppEnvironment {
  constructor (options) {
    this._id = envId++
    this._appPaths = new AppPaths(options.userDataPath)
    this._debug = !!options.debug
    this._isDevMode = !!options.isDevMode
    this._verbose = !!options.verbose
    this._safeMode = !!options.safeMode
    this._disableSpellcheck = !!options.disableSpellcheck
  }

  /**
   * Returns an unique identifier that can be used with IPC to identify messages from this environment.
   *
   * @returns {number} Returns an unique identifier.
   */
  get id () {
    return this._id
  }

  /**
   * @returns {AppPaths}
   */
  get paths () {
    return this._appPaths
  }

  /**
   * @returns {boolean}
   */
  get debug () {
    return this._debug
  }

  /**
   * @returns {boolean}
   */
  get isDevMode () {
    return this._isDevMode
  }

  /**
   * @returns {boolean}
   */
  get verbose () {
    return this._verbose
  }

  /**
   * @returns {boolean}
   */
  get safeMode () {
    return this._safeMode
  }

  /**
   * @returns {boolean}
   */
  get disableSpellcheck () {
    return this._disableSpellcheck
  }
}

/**
 * Create a (global) application environment instance and bootstraps the application.
 *
 * @param {arg.Result} args The parsed application arguments.
 * @returns {AppEnvironment} The current (global) environment.
 */
const setupEnvironment = args => {
  patchEnvPath()

  const isDevMode = process.env.NODE_ENV !== 'production'
  const debug = args['--debug'] || !!process.env.MARKTEXT_DEBUG || process.env.NODE_ENV !== 'production'
  const verbose = args['--verbose'] || 0
  const safeMode = args['--safe']
  const userDataPath = args['--user-data-dir'] // or null (= default user data path)
  const disableSpellcheck = args['--disable-spellcheck']

  const appEnvironment = new AppEnvironment({
    debug,
    isDevMode,
    verbose,
    safeMode,
    userDataPath,
    disableSpellcheck
  })

  ensureAppDirectoriesSync(appEnvironment.paths)

  // Keep this for easier access.
  global.MARKTEXT_DEBUG = debug
  global.MARKTEXT_DEBUG_VERBOSE = verbose
  global.MARKTEXT_SAFE_MODE = safeMode

  return appEnvironment
}

export default setupEnvironment
