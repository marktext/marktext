import { isWindows } from '../../config'

let GetStringRegKey = null
if (isWindows) {
  try {
    GetStringRegKey = require('vscode-windows-registry').GetStringRegKey
  } catch (e) {
    // Ignore webpack build error on macOS and Linux.
  }
}

export const winHKEY = {
  HKCU: 'HKEY_CURRENT_USER',
  HKLM: 'HKEY_LOCAL_MACHINE',
  HKCR: 'HKEY_CLASSES_ROOT',
  HKU: 'HKEY_USERS',
  HKCC: 'HKEY_CURRENT_CONFIG'
}

/**
 * Returns the registry key value.
 *
 * @param {winHKEY} hive The registry key
 * @param {string} path The registry subkey
 * @param {string} name The registry name
 * @returns {string|null|undefined} The registry key value or null/undefined.
 */
export const getStringRegKey = (hive, path, name) => {
  try {
    return GetStringRegKey(hive, path, name)
  } catch (e) {
    return null
  }
}
