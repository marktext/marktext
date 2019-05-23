import { isLinux, isOsx, isWindows } from './index'
import plist from 'plist'
import { remote } from 'electron'

const hasClipboardFiles = () => {
  return remote.clipboard.has('NSFilenamesPboardType')
}

const getClipboardFiles = () => {
  if (!hasClipboardFiles()) { return [] }
  return plist.parse(remote.clipboard.read('NSFilenamesPboardType'))
}

export const guessClipboardFilePath = () => {
  if (isLinux) return ''
  if (isOsx) {
    const result = getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWindows) {
    const rawFilePath = remote.clipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  } else {
    return ''
  }
}
