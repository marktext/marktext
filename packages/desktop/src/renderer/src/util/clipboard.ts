import { isLinux } from './index'

export const guessClipboardFilePath = async(): Promise<string> => {
  if (isLinux) return ''
  try {
    const result = await window.electron.clipboard.guessFilePath()
    return typeof result === 'string' ? result : ''
  } catch {
    return ''
  }
}
