import path from 'path'
import fs from 'fs-extra'
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

const computeIsUpdatable = () => {
  const resources = process.resourcesPath
  if (!resources) return false
  try {
    if (!fs.pathExistsSync(path.join(resources, 'app-update.yml'))) return false
  } catch {
    return false
  }
  if (process.env.APPIMAGE) return true
  if (process.platform === 'win32') {
    try {
      return fs.pathExistsSync(path.join(resources, 'md.ico'))
    } catch {
      return false
    }
  }
  return false
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
  isUpdatable: computeIsUpdatable(),
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
