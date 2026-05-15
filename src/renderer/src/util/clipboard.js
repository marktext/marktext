import { isLinux } from './index'

export const guessClipboardFilePath = async () => {
  if (isLinux) return ''
  const result = await window.clipboardAPI.guessFilePath()
  if (!result) return ''
  if (Array.isArray(result)) return result.length ? result[0] : ''
  return typeof result === 'string' ? result : ''
}
