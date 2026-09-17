import path from 'path'
import { app } from 'electron'
import { setLocalesDirectory } from 'common/i18n'

// A packaged app keeps `static/` beside the executable's resources; every other
// run — the dev server, `electron-vite preview`, the e2e suite — reads it from
// the app directory.
const staticPath = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'static')

// Set `__static` path to static files in production / development depending on the environment
;(global as unknown as { __static: string }).__static = staticPath.replace(/\\/g, '\\\\')

setLocalesDirectory(path.join(staticPath, 'locales'))
