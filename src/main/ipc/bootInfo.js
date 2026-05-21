import { app, ipcMain } from 'electron'
import { rgPath } from '@vscode/ripgrep'
import { MARKDOWN_INCLUSIONS } from 'common/filesystem/paths'

const ENV_ALLOWLIST = [
  'NODE_ENV',
  'PERF_TESTING',
  'APPIMAGE',
  'UNSPLASH_ACCESS_KEY',
  'MARKTEXT_VERSION',
  'MARKTEXT_VERSION_STRING',
  'MARKTEXT_RIPGREP_PATH',
  'PATH',
  'HOME'
]

const pickEnv = () => {
  const out = {}
  for (const key of ENV_ALLOWLIST) {
    if (process.env[key] !== undefined) out[key] = process.env[key]
  }
  return out
}

const resolveRipgrepBinary = () => {
  if (process.env.MARKTEXT_RIPGREP_PATH) {
    return process.env.MARKTEXT_RIPGREP_PATH
  }
  return rgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')
}

const buildBootInfo = () => ({
  platform: process.platform,
  arch: process.arch,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  env: pickEnv(),
  paths: {
    ripgrepBinary: resolveRipgrepBinary(),
    resources: process.resourcesPath,
    appPath: app.getAppPath(),
    cwd: process.cwd()
  },
  MARKDOWN_INCLUSIONS: [...MARKDOWN_INCLUSIONS]
})

let cached = null

export const registerBootInfo = () => {
  ipcMain.on('mt::boot-info', (event) => {
    if (!cached) cached = buildBootInfo()
    event.returnValue = cached
  })
  ipcMain.handle('mt::boot-info-async', () => {
    if (!cached) cached = buildBootInfo()
    return cached
  })
}

export const getBootInfo = () => {
  if (!cached) cached = buildBootInfo()
  return cached
}
