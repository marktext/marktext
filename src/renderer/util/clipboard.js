import { isLinux, isOsx, isWindows } from './index'
import plist from 'plist'
import { clipboard as remoteClipboard } from '@electron/remote'

const hasClipboardFiles = () => {
  return remoteClipboard.has('NSFilenamesPboardType')
}

const getClipboardFiles = () => {
  if (!hasClipboardFiles()) { return [] }
  return plist.parse(remoteClipboard.read('NSFilenamesPboardType'))
}

export const guessClipboardFilePath = () => {
  if (isLinux) return ''
  if (isOsx) {
    const result = getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWindows) {
    const rawFilePath = remoteClipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  } else {
    return ''
  }
}
