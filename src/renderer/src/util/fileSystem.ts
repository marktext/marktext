import dayjs from 'dayjs'

export type FileCreateType = 'file' | 'directory'
export type PasteType = 'cut' | 'copy'
export type HashType = 'sha1' | 'sha256' | 'sha512'

export const create = async(pathname: string, type: FileCreateType): Promise<void> => {
  return type === 'directory'
    ? window.fileUtils.ensureDir(pathname)
    : window.fileUtils.outputFile(pathname, '')
}

export interface PasteOptions {
  src: string
  dest: string
  type: PasteType
}

export const paste = async({ src, dest, type }: PasteOptions): Promise<void> => {
  return type === 'cut' ? window.fileUtils.move(src, dest) : window.fileUtils.copy(src, dest)
}

export const rename = async(src: string, dest: string): Promise<void> => {
  return window.fileUtils.move(src, dest)
}

const toHex = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

// Replacement for crypto.createHash that uses the Web Crypto API. Only SHA-1 is
// used by callers in this file.
export const getHash = async(
  content: string | Uint8Array | ArrayBuffer,
  encoding?: string,
  type?: HashType
): Promise<string> => {
  const algo = type === 'sha1' ? 'SHA-1' : type === 'sha256' ? 'SHA-256' : 'SHA-512'
  let data: Uint8Array
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
  // TS lib's Uint8Array<ArrayBufferLike> doesn't satisfy BufferSource's
  // strict ArrayBuffer expectation in newer @types/node; cast through unknown.
  const digest = await window.crypto.subtle.digest(algo, data as unknown as BufferSource)
  return toHex(digest)
}

export const getContentHash = (content: string | Uint8Array | ArrayBuffer): Promise<string> =>
  getHash(content, 'utf8', 'sha1')

export const moveImageToFolder = async(
  pathname: string,
  image: string | File,
  outputDir: string,
  isRelative = false,
  currentPathname: string | null = null
): Promise<string> => {
  await window.fileUtils.ensureDir(outputDir)
  const isPath = typeof image === 'string'
  if (isPath) {
    const dir = window.path.dirname(pathname)
    const imagePath = window.path.resolve(dir, image as string)
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
      return image as string
    }
  } else {
    const file = image as File
    const imagePath = window.path.join(
      outputDir,
      `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${file.name}`
    )

    const buffer = new Uint8Array(await file.arrayBuffer())
    await window.fileUtils.writeFile(imagePath, buffer)

    if (isRelative && currentPathname) {
      return window.path.relative(window.path.dirname(currentPathname), imagePath)
    }

    return imagePath
  }
}

export interface UploadImagePreferences {
  currentUploader: string
  cliScript?: string
}

export const uploadImage = async(
  pathname: string,
  image: string | File,
  preferences: UploadImagePreferences
): Promise<unknown> => {
  // Pass only a plain serializable object — the full Pinia $state is a Vue
  // Proxy which Electron's structured-clone algorithm cannot serialize.
  const ipcPrefs = {
    currentUploader: preferences.currentUploader,
    cliScript: preferences.cliScript ?? ''
  }
  const isPath = typeof image === 'string'
  if (isPath) {
    return window.uploader.uploadImage({ pathname, image, isPath: true, preferences: ipcPrefs })
  }
  const file = image as File
  const arrayBuffer = await file.arrayBuffer()
  const payload = {
    pathname,
    image: {
      data: new Uint8Array(arrayBuffer),
      name: file.name,
      byteLength: arrayBuffer.byteLength
    },
    isPath: false,
    preferences: ipcPrefs
  }
  return window.uploader.uploadImage(payload)
}

export const isFileExecutable = (filepath: string): Promise<boolean> =>
  window.fileUtils.isExecutable(filepath)
