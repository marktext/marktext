import { app } from 'electron'
import EnvPaths from 'common/envPaths'
import { ensureDirSync } from 'common/filesystem'

class AppPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param {[string]} userDataPath The user data path or null.
   */
  constructor (userDataPath = '') {
    if (!userDataPath) {
      // Use default user data path.
      userDataPath = app.getPath('userData')
    }

    // Initialize environment paths
    super(userDataPath)

    // Changing the user data directory is only allowed during application bootstrap.
    app.setPath('userData', this._electronUserDataPath)
  }
}

export const ensureAppDirectoriesSync = paths => {
  ensureDirSync(paths.userDataPath)
  ensureDirSync(paths.logPath)
  // TODO(sessions): enable this...
  // ensureDirSync(paths.electronUserDataPath)
  // ensureDirSync(paths.globalStorage)
  // ensureDirSync(paths.preferencesPath)
  // ensureDirSync(paths.sessionsPath)
}

export default AppPaths
