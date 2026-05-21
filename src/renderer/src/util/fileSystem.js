import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'

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
  return window.nodeAPI.createHash(type, content, encoding)
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

    const buffer = new Uint8Array(await image.arrayBuffer())
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
  const { currentUploader, imageBed, githubToken: auth } = preferences
  const { owner, repo, branch } = imageBed.github
  const isPath = typeof image === 'string'
  const MAX_SIZE = 5 * 1024 * 1024
  let resolvePromise, rejectPromise
  // eslint-disable-next-line promise/param-names
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

  const parsePicgoOutput = (text) => {
    const raw = String(text || '')
    // eslint-disable-next-line no-control-regex
    const cleaned = raw.replace(/\[[0-9;]*m/g, '')
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

  const uploadByCommand = async (uploader, filepath, suffix = '') => {
    let localPath = filepath
    if (typeof filepath !== 'string') {
      const data = new Uint8Array(filepath)
      localPath = window.path.join(window.nodeAPI.tmpdir(), `${Date.now()}${suffix}`)
      await window.fileUtils.writeFile(localPath, data)
    }

    try {
      const result = await window.execAPI.upload({
        uploader,
        imagePath: localPath
      })

      const text = String(result.stdout || '') + (result.stderr ? `\n${String(result.stderr)}` : '')
      if (uploader === 'picgo') {
        const url = parsePicgoOutput(text)
        if (url) resolvePromise(url)
        else rejectPromise(`PicGo upload error: cannot parse output\n${text.slice(0, 400)}`)
      } else {
        resolvePromise(text.trim())
      }
    } catch (err) {
      rejectPromise(err)
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
            const base64 = window.nodeAPI.bufferToString(fileBuffer, 'base64')
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
            uploadByGithub(window.nodeAPI.bufferToString(reader.result, 'base64'), image.name)
        }
      }
      reader.readAsArrayBuffer(image)
    }
  }
  return promise
}

export const isFileExecutable = (filepath) => {
  return window.execAPI.isFileExecutable(filepath)
}
