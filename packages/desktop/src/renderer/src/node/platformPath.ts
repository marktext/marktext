import { createPlatformPath } from 'common/filesystem/platformPath'

// Shared `common/*` helpers (e.g. `common/envPaths`) import the bare `path`
// specifier, which electron.vite.config.ts aliases to this module so they build
// the same platform-correct paths as `window.path` and the watcher/main (#5683).
export default createPlatformPath(window.electron?.process?.platform === 'win32')
