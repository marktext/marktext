import crypto from 'crypto'

import { statSync, constants } from 'fs'
import { exec, execFile } from 'child_process'
import { tmpdir } from 'os'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { isWindows } from './index'

export const create = async (pathname, type) => {
  return type === 'directory'
    ? window.fileUtils.ensureDir(pathname)
    : window.fileUtils.outputFile(pathname, '')
}

export const paste = async ({ src, dest, type }) => {
  return type === 'cut' ? window.fileUtils.move(src, dest) : window.fileUtils.copy(src, dest)
}

export const rename = async (src, dest) => {
  return window.fileUtils.move(src, dest)
}

export const getHash = (content, encoding, type) => {
  return crypto.createHash(type).update(content, encoding).digest('hex')
}

export const getContentHash = (content) => {
  return getHash(content, 'utf8', 'sha1')
}

export const moveImageToFolder = async (
  pathname,
  image,
  outputDir,
  isRelative = false,
  currentPathname = null
) => {
  await window.fileUtils.ensureDir(outputDir)
  const isPath = typeof image === 'string'
  if (isPath) {
    const dir = window.path.dirname(pathname)
    const imagePath = window.path.resolve(dir, image)
    const isImage = window.fileUtils.isImageFile(imagePath)
    if (isImage) {
      const filename = window.path.basename(imagePath)
      const ext = window.path.extname(imagePath)
      const noHashPath = window.path.join(outputDir, filename)
      if (noHashPath === imagePath) {
        return imagePath
      }
      const hash = getContentHash(imagePath)
      const hashFilePath = window.path.join(outputDir, `${hash}${ext}`)
      await window.fileUtils.copy(imagePath, hashFilePath)
      return hashFilePath
    } else {
      return image
    }
  } else {
    const imagePath = window.path.join(
      outputDir,
      `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${image.name}`
    )

    const buffer = Buffer.from(await image.arrayBuffer())
    await window.fileUtils.writeFile(imagePath, buffer, 'binary')

    if (isRelative && currentPathname) {
      return window.path.relative(window.path.dirname(currentPathname), imagePath)
    }

    return imagePath
  }
}

/**
 * @jocs todo, rewrite it use class
 */
export const uploadImage = async (pathname, image, preferences) => {
  const { currentUploader, imageBed, githubToken: auth, cliScript } = preferences
  const { owner, repo, branch } = imageBed.github
  const isPath = typeof image === 'string'
  const MAX_SIZE = 5 * 1024 * 1024
  let resolvePromise, rejectPromise
  const promise = new Promise((res, rej) => {
    resolvePromise = res
    rejectPromise = rej
  })

  if (currentUploader === 'none') {
    rejectPromise('No image uploader provided.')
  }

  const uploadByGithub = (content, filename) => {
    const octokit = new Octokit({ auth })
    const filePath = `${dayjs().format('YYYY/MM')}/${dayjs().format('DD-HH-mm-ss')}-${filename}`
    const message = `Upload by MarkText at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    const payload = { owner, repo, path: filePath, branch, message, content }
    if (!branch) delete payload.branch
    octokit.repos
      .createOrUpdateFileContents(payload)
      .then((result) => resolvePromise(result.data.content.download_url))
      .catch(() => rejectPromise('Upload failed, the image will be copied to the image folder'))
  }

  // Build a robust PATH for spawned processes (Electron packaged apps often miss Homebrew paths)
  const getPreferredPathEnv = () => {
    const extras =
      process.platform === 'darwin'
        ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
        : process.platform === 'linux'
          ? ['/usr/local/bin', '/usr/bin', '/bin']
          : []
    const cur = (process.env.PATH || '').split(':')
    const merged = [...cur]
    for (const p of extras) if (p && !merged.includes(p)) merged.push(p)
    return merged.filter(Boolean).join(':')
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
        if (window.commandExists?.exists && window.commandExists.exists(c)) return c
        if (
          c.startsWith('/') &&
          window.fileUtils?.pathExistsSync &&
          window.fileUtils.pathExistsSync(c)
        ) {
          return c
        }
      } catch {}
    }
    return null
  }

  const parsePicgoOutput = (text) => {
    const raw = String(text || '')
    const cleaned = raw.replace(/\u001b\[[0-9;]*m/g, '') // strip ANSI colors
    try {
      const lines = cleaned
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      for (const line of lines) {
        if (
          (line.startsWith('{') && line.endsWith('}')) ||
          (line.startsWith('[') && line.endsWith(']'))
        ) {
          try {
            const obj = JSON.parse(line)
            if (obj) {
              // 仅在明确成功时返回 URL
              if (obj.success === true && typeof obj.imgUrl === 'string') return obj.imgUrl
              if (obj.success === true && Array.isArray(obj.result) && obj.result.length > 0) {
                return String(obj.result[obj.result.length - 1])
              }
              if (obj.success === true && typeof obj.url === 'string') return obj.url
            }
          } catch {}
        }
        // 仅在包含 success 关键词时接受 URL
        const kv = line.match(/(?:success|succeeded|uploaded)\s*:?\s*(https?:\/\/\S+)/i)
        if (kv && kv[1]) return kv[1]
      }
      // last non-empty line may be the URL itself
      // 不再使用最后一行 URL 兜底，避免误判成功
    } catch {}
    const marker = cleaned.split('[PicGo SUCCESS]:')
    if (marker.length >= 2) {
      const candidate = marker[marker.length - 1].trim()
      if (/^https?:\/\//i.test(candidate)) return candidate
    }
    // 不再用任意 URL 兜底
    return null
  }

  const uploadByCommand = async (uploader, filepath, suffix = '') => {
    let localIsPath = true
    let localPath = filepath
    if (typeof filepath !== 'string') {
      localIsPath = false
      const data = new Uint8Array(filepath)
      localPath = window.path.join(tmpdir(), `${Date.now()}${suffix}`)
      await window.fileUtils.writeFile(localPath, data)
    }
    const handleExec = (err, data, stderr) => {
      try {
        if (!localIsPath) window.fileUtils?.unlink && window.fileUtils.unlink(localPath)
      } catch {}
      if (err) return rejectPromise(err)
      const text = String(data || '') + (stderr ? `\n${String(stderr)}` : '')
      const url = parsePicgoOutput(text)
      if (url) resolvePromise(url)
      else rejectPromise(`PicGo upload error: cannot parse output\n${text.slice(0, 400)}`)
    }
    if (uploader === 'picgo') {
      const cmd = resolvePicgoBinary()
      if (!cmd) return rejectPromise('PicGo command not found in PATH')
      exec(
        `${cmd} u "${localPath}"`,
        { env: { ...process.env, PATH: getPreferredPathEnv() } },
        handleExec
      )
    } else {
      execFile(
        cliScript,
        [localPath],
        { env: { ...process.env, PATH: getPreferredPathEnv() } },
        (err, data) => {
          try {
            if (!localIsPath) window.fileUtils?.unlink && window.fileUtils.unlink(localPath)
          } catch {}
          if (err) return rejectPromise(err)
          resolvePromise(String(data || '').trim())
        }
      )
    }
  }

  const notification = () => {
    rejectPromise('Cannot upload more than 5M image, the image will be copied to the image folder')
  }

  if (isPath) {
    const dir = window.path.dirname(pathname)
    const imagePath = window.path.resolve(dir, image)
    const isImg = window.fileUtils.isImageFile(imagePath)
    if (isImg) {
      const { size } = await window.fileUtils.stat(imagePath)
      if (size > MAX_SIZE) notification()
      else {
        switch (currentUploader) {
          case 'cliScript':
          case 'picgo':
            uploadByCommand(currentUploader, imagePath)
            break
          case 'github': {
            const fileBuffer = await window.fileUtils.readFile(imagePath)
            const base64 = Buffer.from(fileBuffer).toString('base64')
            uploadByGithub(base64, window.path.basename(imagePath))
            break
          }
        }
      }
    } else {
      resolvePromise(image)
    }
  } else {
    const { size } = image
    if (size > MAX_SIZE) notification()
    else {
      const reader = new FileReader()
      reader.onload = () => {
        switch (currentUploader) {
          case 'picgo':
          case 'cliScript':
            uploadByCommand(currentUploader, reader.result, window.path.extname(image.name))
            break
          default:
            uploadByGithub(Buffer.from(reader.result).toString('base64'), image.name)
        }
      }
      reader.readAsArrayBuffer(image)
    }
  }
  return promise
}

export const isFileExecutableSync = (filepath) => {
  try {
    const stat = statSync(filepath)
    if (process.platform === 'win32') {
      return stat.isFile()
    } else {
      return (
        stat.isFile() &&
        (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
      )
    }
  } catch {
    return false
  }
}
