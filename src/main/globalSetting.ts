import path from 'path'
import { app } from 'electron'

// Set `__static` path to static files in production / development depending on the environment
;(global as unknown as { __static: string }).__static = path
  .join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'static')
  .replace(/\\/g, '\\\\')
