import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import commandExists from 'command-exists'
import { getFonts } from 'font-list'

function getUploadPathEnv() {
  const extras = process.platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    : process.platform === 'linux'
      ? ['/usr/local/bin', '/usr/bin', '/bin']
      : []
  const cur = (process.env.PATH || '').split(path.delimiter)
  const merged = [...cur]
  for (const p of extras) {
    if (p && !merged.includes(p)) merged.push(p)
  }
  return merged.filter(Boolean).join(path.delimiter)
}

function resolvePicgoBinary() {
  const candidates = process.platform === 'win32'
    ? ['picgo', 'picgo.exe']
    : [
      'picgo',
      '/opt/homebrew/bin/picgo',
      '/usr/local/bin/picgo',
      '/usr/bin/picgo',
      `${process.env.HOME}/.npm-global/bin/picgo`,
      `${process.env.HOME}/.npm/bin/picgo`,
      '/usr/local/lib/node_modules/.bin/picgo'
    ]
  for (const c of candidates) {
    try {
      if (commandExists.sync(c)) return c
    } catch {}
    if (c.startsWith('/') && fs.existsSync(c)) return c
  }
  return null
}

export function registerUploadHandlers(accessor) {
  ipcMain.handle('mt::get-system-fonts', async() => {
    return getFonts()
  })

  ipcMain.handle('mt::exec-upload', async(event, { uploader, imagePath }) => {
    const env = { ...process.env, PATH: getUploadPathEnv() }

    let binary
    let args
    if (uploader === 'picgo') {
      binary = resolvePicgoBinary()
      if (!binary) throw new Error('PicGo command not found in PATH')
      args = ['u', imagePath]
    } else if (uploader === 'cliScript') {
      const cliScript = await accessor.dataCenter.getItem('cliScript')
      if (!cliScript || !fs.existsSync(cliScript)) {
        throw new Error('CLI script path does not exist')
      }
      try {
        const stat = fs.statSync(cliScript)
        const isExec = process.platform === 'win32'
          ? stat.isFile()
          : stat.isFile() && (stat.mode & (fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH)) !== 0
        if (!isExec) throw new Error('CLI script is not executable')
      } catch (e) {
        if (e.message === 'CLI script is not executable') throw e
        throw new Error('Cannot verify CLI script')
      }
      binary = cliScript
      args = [imagePath]
    } else {
      throw new Error('Unknown uploader: ' + uploader)
    }

    return new Promise((resolve, reject) => {
      execFile(binary, args, { env }, (err, stdout, stderr) => {
        if (err) return reject(new Error(err.message))
        resolve({ stdout, stderr })
      })
    })
  })
}
