import path from 'path'
import fs from 'fs-extra'
import { app, ipcMain } from 'electron'
import { rgPath } from '@vscode/ripgrep'
import { MARKDOWN_INCLUSIONS } from 'common/filesystem/paths'
import type { BootInfo } from '@shared/types/ipc'

const ENV_ALLOWLIST = [
  'NODE_ENV',
  'PERF_TESTING',
  'APPIMAGE',
  'MARKTEXT_VERSION',
  'MARKTEXT_VERSION_STRING',
  'MARKTEXT_RIPGREP_PATH',
  'PATH',
  'HOME'
]

const pickEnv = (): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

const resolveRipgrepBinary = (): string => {
  if (process.env.MARKTEXT_RIPGREP_PATH) {
    return process.env.MARKTEXT_RIPGREP_PATH
  }
  return rgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')
}

const computeIsUpdatable = (): boolean => {
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

const buildBootInfo = (): BootInfo => ({
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
    userData: app.getPath('userData'),
    cwd: process.cwd()
  },
  isUpdatable: computeIsUpdatable(),
  MARKDOWN_INCLUSIONS: [...MARKDOWN_INCLUSIONS]
})

let cached: BootInfo | null = null

export const registerBootInfo = (): void => {
  ipcMain.on('mt::boot-info', (event) => {
    if (!cached) cached = buildBootInfo()
    event.returnValue = cached
  })
  ipcMain.handle('mt::boot-info-async', () => {
    if (!cached) cached = buildBootInfo()
    return cached
  })
}

export const getBootInfo = (): BootInfo => {
  if (!cached) cached = buildBootInfo()
  return cached
}
