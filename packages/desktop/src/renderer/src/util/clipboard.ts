import { isLinux } from './index'

interface ImageClipboardFallback {
  text: string
  html: string
  marker: string
}

const MAX_PIXELS = 40_000_000

export const readImagePng = async(src: string): Promise<Uint8Array> => {
  const result = await window.electron.clipboard.readImageSource(src)
  if (!result.ok) throw new Error(result.error)
  const bytes = new Uint8Array(result.data)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Image decoding timed out')), 15_000)
    image.onload = () => {
      window.clearTimeout(timer)
      resolve()
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Image could not be decoded'))
    }
    image.src = `data:${result.mime};base64,${btoa(binary)}`
  })
  const { naturalWidth: width, naturalHeight: height } = image
  if (!width || !height || width * height > MAX_PIXELS)
    throw new Error('Image dimensions are too large')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image could not be copied')
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Image could not be copied')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    canvas.width = canvas.height = 0
  }
}

export const copyImageToClipboard = async(
  load: () => Promise<Uint8Array>,
  data?: ImageClipboardFallback,
  isCurrent: () => boolean = () => true
): Promise<boolean> => {
  const clipboard = window.electron.clipboard
  const ticket = await clipboard.beginImageCopy(data?.marker)
  if (ticket === null) return false
  try {
    const png = await load()
    if (!isCurrent()) return false
    return await clipboard.writeImage(png, { ticket, text: data?.text, html: data?.html })
  } finally {
    await clipboard.cancelImageCopy(ticket)
  }
}

/**
 * Cross-document imageAction expects an absolute filesystem path for local images.
 * Decode file URL escapes and omit query/hash suffixes used by the editor's cache;
 * non-file URLs pass through unchanged.
 */
export const clipboardImagePath = (src: string): string => {
  const url = new URL(src)
  if (url.protocol !== 'file:') return src
  let pathname = decodeURIComponent(url.pathname)
  if (url.hostname) pathname = `//${url.hostname}${pathname}`
  // File URLs prefix Windows drive letters with '/', which filesystem paths omit.
  if (window.electron.process.platform === 'win32' && /^\/[a-z]:/i.test(pathname))
    pathname = pathname.slice(1)
  return pathname
}

export const guessClipboardFilePath = async(): Promise<string> => {
  if (isLinux) return ''
  try {
    const result = await window.electron.clipboard.guessFilePath()
    return typeof result === 'string' ? result : ''
  } catch {
    return ''
  }
}
