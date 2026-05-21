import path from 'path'
import { tmpdir } from 'os'
import { exec, execFile } from 'child_process'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { ipcMain } from 'electron'
import commandExists from 'command-exists'
import { isImageFile } from 'common/filesystem/paths'

const buildPreferredPathEnv = () => {
  const extras =
    process.platform === 'darwin'
      ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
      : process.platform === 'linux'
        ? ['/usr/local/bin', '/usr/bin', '/bin']
        : []
  const cur = (process.env.PATH || '').split(path.delimiter)
  const merged = [...cur]
  for (const p of extras) if (p && !merged.includes(p)) merged.push(p)
  return merged.filter(Boolean).join(path.delimiter)
}

const resolvePicgoBinary = () => {
  const candidates =
    process.platform === 'win32'
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
      if (c.startsWith('/') && fs.pathExistsSync(c)) return c
    } catch {}
  }
  return null
}

// Strip ANSI SGR color codes (CSI parameter ... 'm') from picgo output before
// trying to parse it. \x1b is the ESC byte.
const ANSI_SGR_RE = /\x1b\[[0-9;]*m/g // eslint-disable-line no-control-regex

const parsePicgoOutput = (text) => {
  const raw = String(text || '')
  const cleaned = raw.replace(ANSI_SGR_RE, '')
  try {
    const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
        try {
          const obj = JSON.parse(line)
          if (obj) {
            if (obj.success === true && typeof obj.imgUrl === 'string') return obj.imgUrl
            if (obj.success === true && Array.isArray(obj.result) && obj.result.length > 0) {
              return String(obj.result[obj.result.length - 1])
            }
            if (obj.success === true && typeof obj.url === 'string') return obj.url
          }
        } catch {}
      }
      const kv = line.match(/(?:success|succeeded|uploaded)\s*:?\s*(https?:\/\/\S+)/i)
      if (kv && kv[1]) return kv[1]
    }
  } catch {}
  const marker = cleaned.split('[PicGo SUCCESS]:')
  if (marker.length >= 2) {
    const candidate = marker[marker.length - 1].trim()
    if (/^https?:\/\//i.test(candidate)) return candidate
  }
  return null
}

const uploadByGithub = ({ owner, repo, branch, auth, content, filename }) =>
  new Promise((resolve, reject) => {
    const octokit = new Octokit({ auth })
    const filePath = `${dayjs().format('YYYY/MM')}/${dayjs().format('DD-HH-mm-ss')}-${filename}`
    const message = `Upload by MarkText at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    const payload = { owner, repo, path: filePath, branch, message, content }
    if (!branch) delete payload.branch
    octokit.repos
      .createOrUpdateFileContents(payload)
      .then((result) => resolve(result.data.content.download_url))
      .catch(() => reject(new Error('Upload failed, the image will be copied to the image folder')))
  })

const uploadByPicgo = (localPath) =>
  new Promise((resolve, reject) => {
    const cmd = resolvePicgoBinary()
    if (!cmd) return reject(new Error('PicGo command not found in PATH'))
    exec(
      `${cmd} u "${localPath}"`,
      { env: { ...process.env, PATH: buildPreferredPathEnv() } },
      (err, stdout, stderr) => {
        if (err) return reject(err)
        const text = String(stdout || '') + (stderr ? `\n${String(stderr)}` : '')
        const url = parsePicgoOutput(text)
        if (url) resolve(url)
        else reject(new Error(`PicGo upload error: cannot parse output\n${text.slice(0, 400)}`))
      }
    )
  })

const uploadByCli = (cliScript, localPath) =>
  new Promise((resolve, reject) => {
    execFile(
      cliScript,
      [localPath],
      { env: { ...process.env, PATH: buildPreferredPathEnv() } },
      (err, data) => {
        if (err) return reject(err)
        resolve(String(data || '').trim())
      }
    )
  })

const writeBinaryToTmp = async(data, suffix = '') => {
  const buf = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(data || [])
  const tmpPath = path.join(tmpdir(), `${Date.now()}${suffix}`)
  await fs.writeFile(tmpPath, buf)
  return tmpPath
}

const MAX_SIZE = 5 * 1024 * 1024

const uploadFromPath = async(imagePath, options) => {
  const { currentUploader, imageBed, githubToken, cliScript } = options
  const { size } = await fs.stat(imagePath)
  if (size > MAX_SIZE) throw new Error('Cannot upload more than 5M image, the image will be copied to the image folder')

  if (currentUploader === 'cliScript' || currentUploader === 'picgo') {
    if (currentUploader === 'picgo') return uploadByPicgo(imagePath)
    return uploadByCli(cliScript, imagePath)
  }
  if (currentUploader === 'github') {
    const fileBuffer = await fs.readFile(imagePath)
    const base64 = Buffer.from(fileBuffer).toString('base64')
    const { owner, repo, branch } = imageBed.github
    return uploadByGithub({ owner, repo, branch, auth: githubToken, content: base64, filename: path.basename(imagePath) })
  }
  throw new Error(`Unsupported uploader: ${currentUploader}`)
}

const uploadFromBuffer = async({ data, name, byteLength }, options) => {
  const { currentUploader, imageBed, githubToken, cliScript } = options
  if (byteLength > MAX_SIZE) throw new Error('Cannot upload more than 5M image, the image will be copied to the image folder')
  const suffix = path.extname(name || '') || ''
  let cleanup = null
  try {
    if (currentUploader === 'picgo' || currentUploader === 'cliScript') {
      const localPath = await writeBinaryToTmp(data, suffix)
      cleanup = () => fs.unlink(localPath).catch(() => {})
      if (currentUploader === 'picgo') return await uploadByPicgo(localPath)
      return await uploadByCli(cliScript, localPath)
    }
    const buf = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(data || [])
    const base64 = buf.toString('base64')
    const { owner, repo, branch } = imageBed.github
    return await uploadByGithub({ owner, repo, branch, auth: githubToken, content: base64, filename: name })
  } finally {
    if (cleanup) await cleanup()
  }
}

export const registerUploaderHandlers = () => {
  ipcMain.handle('mt::uploader::upload', async(_event, req) => {
    const { pathname, image, isPath, preferences } = req
    if (preferences.currentUploader === 'none') throw new Error('No image uploader provided.')
    if (isPath) {
      const dir = path.dirname(pathname)
      const imagePath = path.resolve(dir, image)
      const isImg = isImageFile(imagePath)
      if (!isImg) return image
      return uploadFromPath(imagePath, preferences)
    }
    return uploadFromBuffer(image, preferences)
  })
}
