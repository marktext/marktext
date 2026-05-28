import path from 'path'
import AppPaths, { ensureAppDirectoriesSync } from './paths'

let envId = 0

const patchEnvPath = (): void => {
  if (process.platform === 'darwin') {
    const currentPath = process.env.PATH ?? ''
    process.env.PATH =
      currentPath +
      (currentPath.endsWith(path.delimiter) ? '' : path.delimiter) +
      '/Library/TeX/texbin'
  }
}

export interface AppEnvironmentOptions {
  userDataPath?: string
  debug?: boolean
  isDevMode?: boolean
  verbose?: number | boolean
  safeMode?: boolean
  disableSpellcheck?: boolean
}

export class AppEnvironment {
  private readonly _id: number
  private readonly _appPaths: AppPaths
  private readonly _debug: boolean
  private readonly _isDevMode: boolean
  private readonly _verbose: boolean
  private readonly _safeMode: boolean
  private readonly _disableSpellcheck: boolean

  constructor(options: AppEnvironmentOptions) {
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
   */
  get id(): number {
    return this._id
  }

  get paths(): AppPaths {
    return this._appPaths
  }

  get debug(): boolean {
    return this._debug
  }

  get isDevMode(): boolean {
    return this._isDevMode
  }

  get verbose(): boolean {
    return this._verbose
  }

  get safeMode(): boolean {
    return this._safeMode
  }

  get disableSpellcheck(): boolean {
    return this._disableSpellcheck
  }
}

/**
 * Create a (global) application environment instance and bootstraps the application.
 *
 * @param args The parsed application arguments (an `arg.Result`-shaped object).
 */
const setupEnvironment = (args: Record<string, unknown>): AppEnvironment => {
  patchEnvPath()

  const isDevMode = process.env.NODE_ENV !== 'production'
  const debug =
    !!args['--debug'] || !!process.env.MARKTEXT_DEBUG || process.env.NODE_ENV !== 'production'
  const verbose = (args['--verbose'] as number | undefined) || 0
  const safeMode = !!args['--safe']
  const userDataPath = args['--user-data-dir'] as string | undefined // or undefined (= default user data path)
  const disableSpellcheck = !!args['--disable-spellcheck']

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
  const mutableGlobal = global as unknown as {
    MARKTEXT_DEBUG: boolean
    MARKTEXT_DEBUG_VERBOSE: number
    MARKTEXT_SAFE_MODE: boolean
  }
  mutableGlobal.MARKTEXT_DEBUG = debug
  mutableGlobal.MARKTEXT_DEBUG_VERBOSE = verbose
  mutableGlobal.MARKTEXT_SAFE_MODE = safeMode

  return appEnvironment
}

export default setupEnvironment
