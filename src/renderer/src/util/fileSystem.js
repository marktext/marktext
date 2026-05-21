import dayjs from 'dayjs'

export const create = async(pathname, type) => {
  return type === 'directory'
    ? window.fileUtils.ensureDir(pathname)
    : window.fileUtils.outputFile(pathname, '')
}

export const paste = async({ src, dest, type }) => {
  return type === 'cut' ? window.fileUtils.move(src, dest) : window.fileUtils.copy(src, dest)
}

export const rename = async(src, dest) => {
  return window.fileUtils.move(src, dest)
}

const toHex = (buf) => {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

// Replacement for crypto.createHash that uses the Web Crypto API. Only SHA-1 is
// used by callers in this file.
export const getHash = async(content, encoding, type) => {
  const algo = type === 'sha1' ? 'SHA-1' : type === 'sha256' ? 'SHA-256' : 'SHA-512'
  let data
  if (encoding === 'utf8' || encoding == null) {
    data = new TextEncoder().encode(typeof content === 'string' ? content : String(content))
  } else if (content instanceof Uint8Array) {
    data = content
  } else if (content instanceof ArrayBuffer) {
    data = new Uint8Array(content)
  } else if (typeof content === 'string') {
    data = new TextEncoder().encode(content)
  } else {
    data = new TextEncoder().encode(String(content))
  }
  const digest = await window.crypto.subtle.digest(algo, data)
  return toHex(digest)
}

export const getContentHash = (content) => getHash(content, 'utf8', 'sha1')

export const moveImageToFolder = async(
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
    const isImage = await window.fileUtils.isImageFile(imagePath)
    if (isImage) {
      const filename = window.path.basename(imagePath)
      const ext = window.path.extname(imagePath)
      const noHashPath = window.path.join(outputDir, filename)
      if (noHashPath === imagePath) {
        return imagePath
      }
      const hash = await getContentHash(imagePath)
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
    await window.fileUtils.writeFile(imagePath, buffer)

    if (isRelative && currentPathname) {
      return window.path.relative(window.path.dirname(currentPathname), imagePath)
    }

    return imagePath
  }
}

export const uploadImage = async(pathname, image, preferences) => {
  if (preferences.currentUploader === 'none') {
    throw new Error('No image uploader provided.')
  }
  const isPath = typeof image === 'string'
  if (isPath) {
    return window.uploader.uploadImage({ pathname, image, isPath: true, preferences })
  }
  const arrayBuffer = await image.arrayBuffer()
  const payload = {
    pathname,
    image: {
      data: new Uint8Array(arrayBuffer),
      name: image.name,
      byteLength: arrayBuffer.byteLength
    },
    isPath: false,
    preferences
  }
  return window.uploader.uploadImage(payload)
}

export const isFileExecutable = (filepath) => window.fileUtils.isExecutable(filepath)
