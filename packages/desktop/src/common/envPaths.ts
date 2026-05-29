import path from 'path'

class EnvPaths {
  private readonly _electronUserDataPath: string
  private readonly _userDataPath: string
  private readonly _logPath: string
  private readonly _preferencesPath: string
  private readonly _editorBufferStorePath: string
  private readonly _dataCenterPath: string
  private readonly _preferencesFilePath: string

  constructor(userDataPath: string) {
    const currentDate = new Date()
    if (!userDataPath) {
      throw new Error('"userDataPath" is not set.')
    }

    this._electronUserDataPath = userDataPath
    this._userDataPath = userDataPath
    this._logPath = path.join(
      this._userDataPath,
      'logs',
      `${currentDate.getFullYear()}${currentDate.getMonth() + 1}`
    )
    this._preferencesPath = userDataPath
    this._editorBufferStorePath = path.join(this._userDataPath, 'editorStates')

    this._dataCenterPath = userDataPath

    this._preferencesFilePath = path.join(this._preferencesPath, 'preference.json')
  }

  get electronUserDataPath(): string {
    // Identical to app.getPath('userData') but userDataPath need not match.
    return this._electronUserDataPath
  }

  get userDataPath(): string {
    return this._userDataPath
  }

  get logPath(): string {
    return this._logPath
  }

  get preferencesPath(): string {
    return this._preferencesPath
  }

  get dataCenterPath(): string {
    return this._dataCenterPath
  }

  get preferencesFilePath(): string {
    return this._preferencesFilePath
  }

  get editorBufferStorePath(): string {
    return this._editorBufferStorePath
  }
}

export default EnvPaths
