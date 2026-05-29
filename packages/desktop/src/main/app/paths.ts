import { app } from 'electron'
import EnvPaths from 'common/envPaths'
import { ensureDirSync } from 'common/filesystem'

class AppPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param userDataPath The user data path or empty string for default.
   */
  constructor(userDataPath: string = '') {
    if (!userDataPath) {
      // Use default user data path.
      userDataPath = app.getPath('userData')
    }

    // Initialize environment paths
    super(userDataPath)

    // Changing the user data directory is only allowed during application bootstrap.
    app.setPath('userData', this.electronUserDataPath)
  }
}

export const ensureAppDirectoriesSync = (paths: AppPaths): void => {
  ensureDirSync(paths.userDataPath)
  ensureDirSync(paths.logPath)
  // TODO(sessions): enable this...
  // ensureDirSync(paths.electronUserDataPath)
  // ensureDirSync(paths.globalStorage)
  // ensureDirSync(paths.preferencesPath)
  // ensureDirSync(paths.sessionsPath)
}

export default AppPaths
