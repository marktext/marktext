import path from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { setLanguagePackDirectories } from 'common/i18n'

/**
 * Discovers drop-in language packs next to the user's data (and, when useful,
 * the working directory) so translators can ship a JSON without rebuilding.
 *
 * Search order (later overrides earlier for the same language id):
 *   1. built-in `static/locales` (set in globalSetting.ts)
 *   2. `<userData>/lang-packs/`  and  `<userData>/locales/`
 *   3. `<cwd>/lang-packs/`  (portable / source checkouts)
 */
export function discoverLanguagePacks(): void {
  // `app.getPath` is only valid after the app is ready.
  const userData = app.getPath('userData')
  const cwd = process.cwd()

  setLanguagePackDirectories([
    { directory: path.join(userData, 'lang-packs'), source: 'user' },
    { directory: path.join(userData, 'locales'), source: 'user' },
    { directory: path.join(cwd, 'lang-packs'), source: 'cwd' }
  ])

  log.info(`Language packs discovered under userData=${userData} cwd=${cwd}`)
}
