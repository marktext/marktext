import { isInElectron, isOsx, isWin } from '../config'
import plist from 'plist'
import electron from 'electron'

export const guessClipboardFilePath = () => {
  if (!isInElectron) return ''
  if (isOsx) {
    const hasClipboardFiles = () => {
      return electron.remote.clipboard.has('NSFilenamesPboardType')
    }
    
    const getClipboardFiles = () => {
      if (!hasClipboardFiles()) { return [] }
      return plist.parse(electron.remote.clipboard.read('NSFilenamesPboardType'))
    }

    const result = getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWin) {
    const rawFilePath = electron.remote.clipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  } else {
    return ''
  }
}
