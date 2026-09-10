// Convert a `data:` URL (e.g. a screenshot pasted from the clipboard bitmap)
// back into a `File` so `imageAction` routes it through the copy-to-folder /
// upload flows. Returns null when the payload is not a base64 image data URL.
export function dataURLToFile(dataUrl: string): File | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const ext =
    mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], `image.${ext}`, { type: mime })
}
